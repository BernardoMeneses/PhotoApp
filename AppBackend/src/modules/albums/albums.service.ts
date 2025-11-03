import { Pool } from 'pg';
import { pool } from '../../config/database';
import { UsersService } from '../users/users.service';
import { CategoriesService } from '../categories/categories.service';

// Interface para Album
export interface Album {
  id: number;
  user_id: string;
  title: string;
  hexcolor: string;
  year: number;
  coverimage: string | null;
  created_at: Date;
}

export interface CreateAlbumData {
  title: string;
  hexcolor: string;
  year: number;
  coverimage?: string;
  categoryId?: number;
}

export class AlbumsService {
  private usersService: UsersService;
  private categoriesService: CategoriesService;

  constructor() {
    // Usar a pool de conexões configurada em database.ts
    this.usersService = new UsersService();
    this.categoriesService = new CategoriesService();
  }

  /**
   * Criar um novo álbum
   * Garante que o usuário existe na base de dados antes de criar o álbum
   * Opcionalmente associa uma categoria ao álbum
   */
  async createAlbum(userId: string, userEmail: string, albumData: CreateAlbumData): Promise<Album> {
    try {
      console.log('📁 Creating album for user:', userId, userEmail);
      
      // Garantir que o usuário existe na base de dados
      await this.usersService.ensureUserExists(userId, userEmail);
      console.log('✅ User verified/created in database');
      
      // Se categoryId foi fornecido, verificar se a categoria existe e pertence ao usuário
      if (albumData.categoryId) {
        console.log('🏷️ Validating category:', albumData.categoryId);
        const categoryExists = await this.categoriesService.categoryExists(albumData.categoryId, userId);
        if (!categoryExists) {
          throw new Error('Category not found or does not belong to user');
        }
        console.log('✅ Category validated');
      }
      
      const query = `
        INSERT INTO Albums (user_id, title, hexcolor, year, coverimage, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *
      `;
      
      const values = [
        userId,
        albumData.title,
        albumData.hexcolor,
        albumData.year,
        albumData.coverimage || null,
      ];

      const result = await pool.query(query, values);
      const album = result.rows[0];
      
      // Se categoria foi fornecida, criar a associação e buscar informações da categoria
      if (albumData.categoryId) {
        console.log('🏷️ Creating album-category association');
        await this.categoriesService.addAlbumCategory(album.id, albumData.categoryId, userId);
        
        // Buscar informações da categoria para retornar junto com o álbum
        const category = await this.categoriesService.getCategoryById(albumData.categoryId, userId);
        if (category) {
          album.category = category;
          console.log('✅ Album created with category:', category.name);
        }
      }
      
      console.log('✅ Album created successfully:', album);
      return album;
      
    } catch (error: any) {
      console.error('❌ Error creating album:', error.message);
      throw new Error(`Failed to create album: ${error.message}`);
    }
  }

  /**
   * Listar todos os álbuns de um usuário
   */
  async getUserAlbums(userId: string): Promise<Album[]> {
    try {
      console.log('📋 Getting albums for user:', userId);
      
      const query = `
        SELECT * FROM Albums 
        WHERE user_id = $1 
        ORDER BY created_at DESC
      `;
      
      const result = await pool.query(query, [userId]);
      
      console.log(`✅ Found ${result.rows.length} Albums for user`);
      return result.rows;
      
    } catch (error: any) {
      console.error('❌ Error getting user albums:', error.message);
      throw new Error(`Failed to get albums: ${error.message}`);
    }
  }

  /**
   * Listar todos os álbuns de um usuário com informações de categoria
   */
  async getUserAlbumsWithCategories(userId: string): Promise<any[]> {
    try {
      console.log('📋 Getting albums with categories for user:', userId);
      
      const query = `
        SELECT 
          a.*,
          c.id as category_id,
          c.name as category_name,
          c.description as category_description,
          c.color as category_color
        FROM Albums a
        LEFT JOIN albums_categories ac ON a.id = ac.album_id
        LEFT JOIN Categories c ON ac.category_id = c.id
        WHERE a.user_id = $1 
        ORDER BY a.created_at DESC
      `;
      
      const result = await pool.query(query, [userId]);
      
      console.log(`✅ Found ${result.rows.length} Albums with categories for user`);
      return result.rows.map(row => ({
        id: row.id,
        user_id: row.user_id,
        title: row.title,
        hexcolor: row.hexcolor,
        year: row.year,
        coverimage: row.coverimage,
        created_at: row.created_at,
        category: row.category_id ? {
          id: row.category_id,
          name: row.category_name,
          description: row.category_description,
          color: row.category_color
        } : null
      }));
      
    } catch (error: any) {
      console.error('❌ Error getting user albums with categories:', error.message);
      throw new Error(`Failed to get albums with categories: ${error.message}`);
    }
  }

  /**
   * Obter um álbum específico
   */
  async getAlbumById(albumId: number, userId: string): Promise<Album | null> {
    try {
      console.log('📖 Getting album:', albumId, 'for user:', userId);
      
      const query = `
        SELECT * FROM Albums 
        WHERE id = $1 AND user_id = $2
      `;
      
      const result = await pool.query(query, [albumId, userId]);
      
      if (result.rows.length === 0) {
        console.log('❌ Album not found or access denied');
        return null;
      }
      
      console.log('✅ Album found:', result.rows[0]);
      return result.rows[0];
      
    } catch (error: any) {
      console.error('❌ Error getting album:', error.message);
      throw new Error(`Failed to get album: ${error.message}`);
    }
  }

  /**
   * Atualizar um álbum
   */
  async updateAlbum(albumId: number, userId: string, updateData: Partial<CreateAlbumData>): Promise<Album | null> {
    try {
      console.log('✏️ Updating album:', albumId, 'for user:', userId);
      
      // Se categoryId foi fornecido, verificar se a categoria existe e pertence ao usuário
      if (updateData.categoryId !== undefined) {
        if (updateData.categoryId !== null) {
          console.log('🏷️ Validating new category:', updateData.categoryId);
          const categoryExists = await this.categoriesService.categoryExists(updateData.categoryId, userId);
          if (!categoryExists) {
            throw new Error('Category not found or does not belong to user');
          }
          console.log('✅ Category validated');
        }
      }
      
      // Construir query dinâmica baseada nos campos fornecidos
      const fields = [];
      const values = [];
      let paramCount = 1;

      if (updateData.title) {
        fields.push(`title = $${paramCount}`);
        values.push(updateData.title);
        paramCount++;
      }

      if (updateData.hexcolor) {
        fields.push(`hexcolor = $${paramCount}`);
        values.push(updateData.hexcolor);
        paramCount++;
      }

      if (updateData.coverimage !== undefined) {
        fields.push(`coverimage = $${paramCount}`);
        values.push(updateData.coverimage);
        paramCount++;
      }

      if (fields.length === 0 && updateData.categoryId === undefined) {
        throw new Error('No fields to update');
      }

      // Atualizar álbum se há campos para atualizar
      let album = null;
      if (fields.length > 0) {
        values.push(albumId, userId);
        
        const query = `
          UPDATE Albums 
          SET ${fields.join(', ')}
          WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
          RETURNING *
        `;

        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
          console.log('❌ Album not found or access denied');
          return null;
        }
        
        album = result.rows[0];
        console.log('✅ Album updated:', album);
      } else {
        // Se só está atualizando categoria, buscar o álbum
        const getAlbumQuery = `SELECT * FROM Albums WHERE id = $1 AND user_id = $2`;
        const getResult = await pool.query(getAlbumQuery, [albumId, userId]);
        
        if (getResult.rows.length === 0) {
          console.log('❌ Album not found or access denied');
          return null;
        }
        
        album = getResult.rows[0];
      }
      
      // Atualizar categoria se fornecida
      if (updateData.categoryId !== undefined) {
        console.log('🏷️ Updating album category');
        
        // Primeiro, remover associações existentes
        await pool.query(
          `DELETE FROM albums_categories WHERE album_id = $1`,
          [albumId]
        );
        
        // Se a nova categoria não é null, criar a nova associação
        if (updateData.categoryId !== null) {
          await this.categoriesService.addAlbumCategory(albumId, updateData.categoryId, userId);
          
          // Buscar informações da categoria para incluir na resposta
          const category = await this.categoriesService.getCategoryById(updateData.categoryId, userId);
          if (category) {
            album.category = category;
            console.log('✅ Album category updated to:', category.name);
          }
        } else {
          console.log('✅ Album category removed');
          album.category = null;
        }
      }
      
      return album;
      
    } catch (error: any) {
      console.error('❌ Error updating album:', error.message);
      throw new Error(`Failed to update album: ${error.message}`);
    }
  }

  /**
   * Deletar um álbum
   */
  async deleteAlbum(albumId: number, userId: string): Promise<boolean> {
    try {
      console.log('🗑️ Deleting album:', albumId, 'for user:', userId);
      
      const query = `
        DELETE FROM Albums 
        WHERE id = $1 AND user_id = $2
      `;
      
      const result = await pool.query(query, [albumId, userId]);
      
      if (result.rowCount === 0) {
        console.log('❌ Album not found or access denied');
        return false;
      }
      
      console.log('✅ Album deleted successfully');
      return true;
      
    } catch (error: any) {
      console.error('❌ Error deleting album:', error.message);
      throw new Error(`Failed to delete album: ${error.message}`);
    }
  }

  /**
   * Obter uma foto aleatória do usuário para usar como capa
   */
  async getRandomUserPhoto(userId: string): Promise<string | null> {
    // Esta função vai buscar uma foto aleatória das fotos do usuário na cloud
    // Por agora retorna null, mas depois pode integrar com o PhotosService
    try {
      console.log('🖼️ Getting random photo for user:', userId);
      
      // TODO: Integrar com PhotosService para buscar fotos reais do usuário
      // Por agora retorna um placeholder
      return null;
      
    } catch (error: any) {
      console.error('❌ Error getting random photo:', error.message);
      return null;
    }
  }
  /**
   * Adicionar uma foto a um álbum
   */
  async addPhotoToAlbum(albumId: number, userId: string, photoName: string, photoUrl: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Adicionar foto ao álbum
      const insertQuery = `
        INSERT INTO albumphotos (album_id, user_id, photo_name, photo_url)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
      `;
      const insertResult = await client.query(insertQuery, [albumId, userId, photoName, photoUrl]);

      // 2. Atualizar status da foto de 'unsorted' para 'album' na photo_metadata
      // O photoName pode ser tanto photo_id como photo_name, então verificamos ambos
      const updateQuery = `
        UPDATE photo_metadata 
        SET status = 'album', moved_to_library_at = NOW(), updated_at = NOW()
        WHERE user_id = $1 AND (photo_id = $2 OR photo_name = $2) AND status = 'unsorted'
      `;
      const updateResult = await client.query(updateQuery, [userId, photoName]);

      await client.query('COMMIT');
      
      console.log(`✅ Photo ${photoName} added to album ${albumId} and status updated to album`);
      console.log(`📊 Updated ${updateResult.rowCount} rows in photo_metadata`);
      
      return insertResult.rows[0];
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('❌ Error adding photo to album:', error.message);
      throw new Error(`Failed to add photo to album: ${error.message}`);
    } finally {
      client.release();
    }
  }
/**
 * Obter as fotos de um álbum
 */
async getAlbumPhotos(albumId: number, userId: string) {
  const query = `
    SELECT * FROM albumphotos
    WHERE album_id = $1 AND user_id = $2
    ORDER BY created_at DESC;
  `;
  const result = await pool.query(query, [albumId, userId]);
  return result.rows;
}
/**
 * Remover uma foto de um álbum
 */
async removePhotoFromAlbum(albumId: number, userId: string, photoName: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Remover foto do álbum
    const deleteQuery = `
      DELETE FROM albumphotos
      WHERE album_id = $1 AND user_id = $2 AND photo_name = $3
    `;
    const deleteResult = await client.query(deleteQuery, [albumId, userId, photoName]);

    // 2. Voltar status da foto para 'unsorted' na photo_metadata
    const updateQuery = `
      UPDATE photo_metadata 
      SET status = 'unsorted', moved_to_library_at = NULL, updated_at = NOW()
      WHERE user_id = $1 AND (photo_id = $2 OR photo_name = $2) AND status = 'album'
    `;
    const updateResult = await client.query(updateQuery, [userId, photoName]);

    await client.query('COMMIT');
    
    console.log(`✅ Photo ${photoName} removed from album ${albumId} and status updated to unsorted`);
    console.log(`📊 Updated ${updateResult.rowCount} rows in photo_metadata`);
    
    return deleteResult.rowCount !== null && deleteResult.rowCount > 0;
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Error removing photo from album:', error.message);
    throw new Error(`Failed to remove photo from album: ${error.message}`);
  } finally {
    client.release();
  }
}

async getAlbumWithCategories(albumId: number, userId: string) {
  const album = await this.getAlbumById(albumId, userId);
  if (!album) return null;

  const categories = await pool.query(
    `SELECT c.id, c.name 
     FROM categories c 
     JOIN albums_categories ac ON ac.category_id = c.id 
     WHERE ac.album_id = $1`,
    [albumId]
  );

  return { ...album, categories: categories.rows };
}

/**
 * Adicionar múltiplas fotos a um álbum de uma vez
 */
async batchAddPhotosToAlbum(
  albumId: number, 
  userId: string, 
  photos: Array<{ photoName: string; photoUrl: string }>
): Promise<{ success: Array<any>, failed: Array<{ photoName: string; error: string }> }> {
  const results = {
    success: [] as Array<any>,
    failed: [] as Array<{ photoName: string; error: string }>
  };

  for (const photo of photos) {
    try {
      const addedPhoto = await this.addPhotoToAlbum(albumId, userId, photo.photoName, photo.photoUrl);
      results.success.push(addedPhoto);
    } catch (error: any) {
      console.error(`❌ Failed to add photo ${photo.photoName} to album:`, error.message);
      results.failed.push({
        photoName: photo.photoName,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Calcular o tamanho total de um álbum
 */
async getAlbumTotalSize(albumId: number, userId: string): Promise<{ totalSize: number, photoCount: number, formattedSize: string }> {
  try {
    console.log(`📊 Calculating total size for album ${albumId} of user ${userId}`);
    
    // Verificar se o álbum existe e pertence ao usuário
    const album = await this.getAlbumById(albumId, userId);
    if (!album) {
      throw new Error('Album not found or access denied');
    }

    // Obter as fotos do álbum
    const albumPhotos = await this.getAlbumPhotos(albumId, userId);
    
    if (albumPhotos.length === 0) {
      return {
        totalSize: 0,
        photoCount: 0,
        formattedSize: '0 B'
      };
    }

    // Importar PhotosService para obter informações das fotos com tamanhos
    const { PhotosService } = await import('../photos/photos.service');
    const photosService = new PhotosService();
    
    // Obter todas as fotos do usuário com informações de tamanho
    const userPhotos = await photosService.listUserPhotos(userId);
    
    // Criar um map para lookup rápido por nome da foto
    const photoSizeMap = new Map();
    userPhotos.forEach(photo => {
      photoSizeMap.set(photo.name, parseInt(photo.size) || 0);
    });

    // Calcular tamanho total
    let totalSize = 0;
    albumPhotos.forEach(albumPhoto => {
      const photoSize = photoSizeMap.get(albumPhoto.photo_name) || 0;
      totalSize += photoSize;
    });

    // Formatar o tamanho para legibilidade
    const formattedSize = this.formatBytes(totalSize);

    console.log(`✅ Album ${albumId} total size: ${formattedSize} (${albumPhotos.length} photos)`);

    return {
      totalSize,
      photoCount: albumPhotos.length,
      formattedSize
    };

  } catch (error: any) {
    console.error('❌ Error calculating album total size:', error.message);
    throw new Error(`Failed to calculate album size: ${error.message}`);
  }
}

/**
 * Formatar bytes em formato legível
 */
private formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

  /**
   * Fechar conexão com a base de dados
   */
  async close(): Promise<void> {
    await pool.end();
  }
}