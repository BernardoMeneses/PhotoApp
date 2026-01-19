import { v4 as uuidv4 } from "uuid";
import { googleDriveService } from "../../services/google-drive.service";
import { GoogleDriveTokenService } from "../../services/google-drive-token.service";
import { pool } from "../../config/database";
import { UsersService } from "../users/users.service";

const usersService = new UsersService();

export class PhotosService {
  // Upload para Google Drive (método principal)
  async uploadPhoto(file: Express.Multer.File) {
    throw new Error("Use uploadPhotosWithUser method instead");
  }

  // Upload com userId para múltiplas fotos - APENAS GOOGLE DRIVE
  async uploadPhotosWithUser(files: Express.Multer.File[], userId: string) {
    const uploadedPhotos = [];

    console.log(`📤 Fazendo upload de ${files.length} foto(s) para Google Drive do usuário ${userId}`);

    // Verificar se o usuário tem tokens do Google Drive
    const hasGoogleDriveTokens = await GoogleDriveTokenService.hasTokens(userId);
    
    if (!hasGoogleDriveTokens) {
      throw new Error("Google Drive não conectado. Por favor, conecte seu Google Drive primeiro.");
    }

    // Obter tokens válidos (com refresh automático se expirados)
    const tokens = await GoogleDriveTokenService.getValidTokens(userId);
    if (!tokens) {
      throw new Error("Falha ao carregar tokens do Google Drive");
    }

    console.log(`🔑 Tokens válidos obtidos para usuário ${userId}`);

    // Upload para Google Drive
    for (const file of files) {
      const fileName = `${uuidv4()}-${file.originalname}`;
      
      try {
        const driveFile = await googleDriveService.uploadPhoto(
          tokens,
          fileName,
          file.buffer,
          file.mimetype
        );

        uploadedPhotos.push({
          id: driveFile.id,
          name: fileName,
          url: `https://lh3.googleusercontent.com/d/${driveFile.id}=w1000-h1000`,
          thumbnailUrl: `https://lh3.googleusercontent.com/d/${driveFile.id}=w300-h300`,
          fullUrl: `https://drive.google.com/uc?id=${driveFile.id}&export=download`,
          driveId: driveFile.id,
          source: 'google-drive'
        });

        // Guardar metadados na base de dados com status 'unsorted'
        await this.savePhotoMetadata(userId, driveFile.id, fileName, 
          `https://lh3.googleusercontent.com/d/${driveFile.id}=w1000-h1000`, 'unsorted');

        console.log(`✅ Foto ${fileName} uploaded para Google Drive`);
      } catch (error: any) {
        console.error(`❌ Erro ao fazer upload de ${fileName}:`, error.message);
        throw new Error(`Falha ao fazer upload de ${fileName}: ${error.message}`);
      }
    }

    console.log(`🎉 ${uploadedPhotos.length} foto(s) uploaded com sucesso para Google Drive`);
    return uploadedPhotos;
  }

  // Lista todas as fotos (agora apenas do Google Drive)
  async listAllPhotos() {
    throw new Error("Use listUserPhotos method with userId instead");
  }

  // Lista fotos de um usuário específico - APENAS GOOGLE DRIVE
  async listUserPhotos(userId: string) {
    console.log(`📋 Buscando fotos do Google Drive para usuário ${userId}`);

    // Verificar se o usuário tem tokens do Google Drive
    const hasGoogleDriveTokens = await GoogleDriveTokenService.hasTokens(userId);
    
    if (!hasGoogleDriveTokens) {
      throw new Error("Google Drive não conectado. Por favor, conecte seu Google Drive primeiro.");
    }

    try {
      // Obter tokens válidos (com refresh automático se expirados)
      const tokens = await GoogleDriveTokenService.getValidTokens(userId);
      if (!tokens) {
        throw new Error("Falha ao carregar tokens do Google Drive");
      }

      const drivePhotos = await googleDriveService.listPhotos(tokens);
      
      // Converter formato do Google Drive para o formato esperado
      const formattedDrivePhotos = drivePhotos.map(photo => ({
        id: photo.id,
        name: photo.name,
        url: `https://lh3.googleusercontent.com/d/${photo.id}=w1000-h1000`,
        thumbnailUrl: `https://lh3.googleusercontent.com/d/${photo.id}=w300-h300`,
        fullUrl: `https://drive.google.com/uc?id=${photo.id}&export=download`,
        driveId: photo.id,
        source: 'google-drive',
        createdTime: photo.createdTime,
        size: photo.size
      }));

      console.log(`📋 Encontradas ${formattedDrivePhotos.length} fotos no Google Drive`);
      return formattedDrivePhotos;

    } catch (error: any) {
      console.error('❌ Erro ao buscar fotos do Google Drive:', error.message);
      throw new Error(`Falha ao buscar fotos: ${error.message}`);
    }
  }

  // ========================================
  // MÉTODOS DE GESTÃO DE METADADOS
  // ========================================

  // Guardar metadados da foto na base de dados
  async savePhotoMetadata(userId: string, photoId: string, photoName: string, photoUrl: string, status: 'unsorted' | 'library' | 'album' = 'unsorted') {
    const client = await pool.connect();
    try {
      // Verificar se o utilizador existe na base de dados (criar se não existir)
      const userExists = await usersService.userExists(userId);
      if (!userExists) {
        console.log(`⚠️ Utilizador ${userId} não existe na BD. A criar...`);
        // Criar utilizador com email placeholder (será atualizado no próximo login)
        await client.query(`
          INSERT INTO Users (id, email, password_hash, created_at)
          VALUES ($1, $2, 'FIREBASE_AUTH', NOW())
          ON CONFLICT (id) DO NOTHING
        `, [userId, `user_${userId}@temp.local`]);
      }
      
      await client.query(`
        INSERT INTO photo_metadata (user_id, photo_id, photo_name, photo_url, status, created_time)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (user_id, photo_id) 
        DO UPDATE SET 
          photo_name = EXCLUDED.photo_name,
          photo_url = EXCLUDED.photo_url,
          updated_at = NOW()
      `, [userId, photoId, photoName, photoUrl, status]);
      
      console.log(`💾 Metadados salvos: ${photoName} (status: ${status})`);
    } catch (error: any) {
      console.error('❌ Erro ao salvar metadados:', error.message);
      throw error; // Re-throw para que o chamador saiba que falhou
    } finally {
      client.release();
    }
  }

  // Lista apenas fotos UNSORTED (por trabalhar)
  async listUnsortedPhotos(userId: string) {
    console.log(`📥 Buscando fotos UNSORTED para usuário ${userId}`);
    
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT photo_id, photo_name, photo_url, created_time, created_at
        FROM photo_metadata 
        WHERE user_id = $1 AND status = 'unsorted'
        ORDER BY created_at DESC
      `, [userId]);

      // Buscar detalhes completos do Google Drive para as fotos unsorted
      const unsortedPhotos = result.rows.map(row => ({
        id: row.photo_id,
        name: row.photo_name,
        url: row.photo_url,
        thumbnailUrl: `https://lh3.googleusercontent.com/d/${row.photo_id}=w300-h300`,
        fullUrl: `https://drive.google.com/uc?id=${row.photo_id}&export=download`,
        driveId: row.photo_id,
        source: 'google-drive',
        createdTime: row.created_time,
        uploadedAt: row.created_at,
        status: 'unsorted'
      }));

      console.log(`📥 Encontradas ${unsortedPhotos.length} fotos unsorted`);
      return unsortedPhotos;
    } catch (error: any) {
      console.error('❌ Erro ao buscar fotos unsorted:', error.message);
      throw new Error(`Falha ao buscar fotos unsorted: ${error.message}`);
    } finally {
      client.release();
    }
  }

  // Lista fotos do usuário organizadas por data (biblioteca) - APENAS fotos com status 'library'
  async listLibraryPhotos(userId: string) {
    console.log(`📚 Organizando biblioteca de fotos para usuário ${userId}`);

    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT photo_id, photo_name, photo_url, created_time, moved_to_library_at
        FROM photo_metadata 
        WHERE user_id = $1 AND status = 'library'
        ORDER BY created_time DESC
      `, [userId]);

      const libraryPhotos = result.rows.map(row => ({
        id: row.photo_id,
        name: row.photo_name,
        url: row.photo_url,
        thumbnailUrl: `https://lh3.googleusercontent.com/d/${row.photo_id}=w300-h300`,
        fullUrl: `https://drive.google.com/uc?id=${row.photo_id}&export=download`,
        driveId: row.photo_id,
        source: 'google-drive',
        createdTime: row.created_time,
        movedToLibraryAt: row.moved_to_library_at,
        status: 'library'
      }));

      // Agrupamento por ano/mês/dia
      const grouped: Record<string, Record<string, Record<string, any[]>>> = {};

      for (const photo of libraryPhotos) {
        const date = new Date(photo.createdTime || photo.movedToLibraryAt);

        const year = date.getFullYear().toString();
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const day = date.getDate().toString().padStart(2, "0");

        if (!grouped[year]) grouped[year] = {};
        if (!grouped[year][month]) grouped[year][month] = {};
        if (!grouped[year][month][day]) grouped[year][month][day] = [];

        grouped[year][month][day].push(photo);
      }

      console.log(`📚 Biblioteca organizada: ${libraryPhotos.length} fotos em ${Object.keys(grouped).length} anos`);
      return grouped;
    } catch (error: any) {
      console.error('❌ Erro ao buscar biblioteca:', error.message);
      throw new Error(`Falha ao buscar biblioteca: ${error.message}`);
    } finally {
      client.release();
    }
  }

  // Move fotos de UNSORTED para LIBRARY
  async movePhotosToLibrary(userId: string, photoIds: string[]) {
    console.log(`📚 Movendo ${photoIds.length} fotos para Library`);
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const photoId of photoIds) {
        await client.query(`
          UPDATE photo_metadata 
          SET status = 'library', moved_to_library_at = NOW(), updated_at = NOW()
          WHERE user_id = $1 AND photo_id = $2 AND status = 'unsorted'
        `, [userId, photoId]);
      }

      await client.query('COMMIT');
      console.log(`✅ ${photoIds.length} fotos movidas para Library`);
      
      return { success: true, moved: photoIds.length };
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('❌ Erro ao mover fotos para Library:', error.message);
      throw new Error(`Falha ao mover fotos: ${error.message}`);
    } finally {
      client.release();
    }
  }

  // ✅ NOVO: Move fotos de LIBRARY/ALBUM de volta para UNSORTED
  async movePhotosToUnsorted(userId: string, photoIds: string[]) {
    console.log(`🔄 Movendo ${photoIds.length} fotos de volta para UNSORTED para usuário ${userId}`);
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const photoId of photoIds) {
        // Atualizar status de qualquer foto (library ou album) para unsorted
        await client.query(`
          UPDATE photo_metadata 
          SET status = 'unsorted', moved_to_library_at = NULL, updated_at = NOW()
          WHERE user_id = $1 AND (photo_id = $2 OR photo_name = $2) AND status IN ('library', 'album')
        `, [userId, photoId]);
        
        console.log(`🔄 Foto ${photoId} movida de volta para unsorted`);
      }

      await client.query('COMMIT');
      console.log(`✅ ${photoIds.length} fotos movidas de volta para UNSORTED`);
      
      return { success: true, moved: photoIds.length };
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('❌ Erro ao mover fotos para UNSORTED:', error.message);
      throw new Error(`Falha ao mover fotos para unsorted: ${error.message}`);
    } finally {
      client.release();
    }
  }

  // Deletar uma foto específica de um usuário - APENAS GOOGLE DRIVE
  async deleteUserPhoto(photoIdOrName: string, userId: string): Promise<boolean> {
  console.log(`🗑️ Deletando foto ${photoIdOrName} do Google Drive do usuário ${userId}`);

  const hasGoogleDriveTokens = await GoogleDriveTokenService.hasTokens(userId);
  if (!hasGoogleDriveTokens) {
    throw new Error("Google Drive não conectado. Por favor, conecte seu Google Drive primeiro.");
  }

  const client = await pool.connect();
  try {
    // Obter tokens válidos (com refresh automático se expirados)
    const tokens = await GoogleDriveTokenService.getValidTokens(userId);
    if (!tokens) throw new Error("Falha ao carregar tokens do Google Drive");

    // 🔍 Encontrar a foto pelo ID ou nome (parcialmente se necessário)
    const { rows } = await client.query(
      `
      SELECT photo_id, photo_name
      FROM photo_metadata
      WHERE user_id = $1
      AND (photo_id = $2 OR photo_name = $2 OR photo_name LIKE '%' || $2 || '%')
      LIMIT 1
      `,
      [userId, photoIdOrName]
    );

    if (rows.length === 0) {
      console.warn(`⚠️ Foto ${photoIdOrName} não encontrada na base de dados.`);
      return false;
    }

    const photo = rows[0];
    const deleted = await googleDriveService.deletePhoto(tokens, photo.photo_id);

    if (deleted) {
      await client.query(
        `
        DELETE FROM photo_metadata 
        WHERE user_id = $1
        AND (photo_id = $2 OR photo_name = $3 OR photo_name LIKE '%' || $3 || '%')
        `,
        [userId, photo.photo_id, photo.photo_name]
      );

      console.log(`✅ Foto ${photo.photo_name} removida do Drive e da base de dados`);
      return true;
    } else {
      console.warn(`⚠️ Foto ${photo.photo_name} não encontrada no Google Drive`);
      return false;
    }
  } catch (error: any) {
    console.error("❌ Erro ao deletar foto:", error.message);
    throw new Error(`Falha ao deletar foto: ${error.message}`);
  } finally {
    client.release();
  }
}

  // Deletar foto por URL (extrair ID do arquivo da URL do Google Drive)
  async deletePhotoByUrl(photoUrl: string, userId: string): Promise<boolean> {
    try {
      // Extrair o ID do arquivo da URL do Google Drive
      // URL formato: https://drive.google.com/uc?id=FILE_ID&export=download
      const match = photoUrl.match(/id=([^&]+)/);
      if (!match) {
        throw new Error("URL inválida do Google Drive");
      }
      
      const fileId = match[1];
      return await this.deleteUserPhoto(fileId, userId);
      
    } catch (error: any) {
      console.error(`❌ Erro ao deletar foto por URL: ${error.message}`);
      throw error;
    }
  }

  // Deletar múltiplas fotos de uma vez - APENAS GOOGLE DRIVE
  async batchDeletePhotos(photoIdentifiers: string[], userId: string): Promise<{ success: string[]; failed: string[] }> {
  console.log(`🗑️ Deletando ${photoIdentifiers.length} fotos em lote do Google Drive`);

  const hasGoogleDriveTokens = await GoogleDriveTokenService.hasTokens(userId);
  if (!hasGoogleDriveTokens) {
    throw new Error("Google Drive não conectado. Por favor, conecte seu Google Drive primeiro.");
  }

  // Obter tokens válidos (com refresh automático se expirados)
  const tokens = await GoogleDriveTokenService.getValidTokens(userId);
  if (!tokens) throw new Error("Falha ao carregar tokens do Google Drive");

  const client = await pool.connect();
  const success: string[] = [];
  const failed: string[] = [];

  try {
    await client.query("BEGIN");

    for (const identifier of photoIdentifiers) {
      try {
        // 🔍 Procurar foto por ID, nome ou correspondência parcial
        const { rows } = await client.query(
          `
          SELECT photo_id, photo_name
          FROM photo_metadata
          WHERE user_id = $1
          AND (photo_id = $2 OR photo_name = $2 OR photo_name LIKE '%' || $2 || '%')
          LIMIT 1
          `,
          [userId, identifier]
        );

        if (rows.length === 0) {
          console.warn(`⚠️ Foto ${identifier} não encontrada na base de dados.`);
          failed.push(identifier);
          continue;
        }

        const photo = rows[0];
        const deleted = await googleDriveService.deletePhoto(tokens, photo.photo_id);

        if (deleted) {
          await client.query(
            `
            DELETE FROM photo_metadata 
            WHERE user_id = $1
            AND (photo_id = $2 OR photo_name = $3 OR photo_name LIKE '%' || $3 || '%')
            `,
            [userId, photo.photo_id, photo.photo_name]
          );

          success.push(photo.photo_id);
          console.log(`✅ Foto ${photo.photo_name} removida`);
        } else {
          failed.push(identifier);
          console.warn(`⚠️ Foto ${photo.photo_name} não encontrada no Drive`);
        }
      } catch (err: any) {
        console.error(`❌ Falha ao deletar ${identifier}:`, err.message);
        failed.push(identifier);
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Erro no batch delete:", err);
    failed.push(...photoIdentifiers);
  } finally {
    client.release();
  }

  console.log(`✅ ${success.length} deletadas | ❌ ${failed.length} falharam`);
  return { success, failed };
}
}

