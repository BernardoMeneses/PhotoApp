import { pool } from "../../config/database";

export interface Category {
  id: number;
  user_id: string;
  name: string;
  description?: string;
  color?: string;
  created_at: Date;
}

export interface CreateCategoryData {
  name: string;
  description?: string;
  color?: string;
}

export class CategoriesService {
  
  /**
   * Criar uma nova categoria para um usuário
   */
  async createCategory(userId: string, categoryData: CreateCategoryData): Promise<Category> {
    try {
      console.log('📂 Creating category for user:', userId);
      
      const query = `
        INSERT INTO Categories (user_id, name, description, color, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `;
      
      const values = [
        userId,
        categoryData.name,
        categoryData.description || null,
        categoryData.color || '#007bff'
      ];

      const result = await pool.query(query, values);
      
      console.log('✅ Category created successfully:', result.rows[0]);
      return result.rows[0];
      
    } catch (error: any) {
      console.error('❌ Error creating category:', error.message);
      throw new Error(`Failed to create category: ${error.message}`);
    }
  }

  /**
   * Obter todas as categorias de um usuário
   */
  async getUserCategories(userId: string): Promise<Category[]> {
    try {
      console.log('📋 Getting categories for user:', userId);
      
      const query = `
        SELECT * FROM Categories 
        WHERE user_id = $1 
        ORDER BY name ASC
      `;
      
      const result = await pool.query(query, [userId]);
      
      console.log(`✅ Found ${result.rows.length} categories for user`);
      return result.rows;
      
    } catch (error: any) {
      console.error('❌ Error getting user categories:', error.message);
      throw new Error(`Failed to get categories: ${error.message}`);
    }
  }

  /**
   * Verificar se uma categoria existe e pertence ao usuário
   */
  async categoryExists(categoryId: number, userId: string): Promise<boolean> {
    try {
      const query = `
        SELECT id FROM Categories 
        WHERE id = $1 AND user_id = $2
      `;
      
      const result = await pool.query(query, [categoryId, userId]);
      return result.rows.length > 0;
      
    } catch (error: any) {
      return false;
    }
  }

  /**
   * Associar um álbum a uma categoria
   */
  async addAlbumCategory(albumId: number, categoryId: number, userId: string) {
    try {
      console.log('🔗 Adding album', albumId, 'to category', categoryId);
      
      // Primeiro, remover qualquer associação existente para este álbum
      // (para garantir que um álbum só tem uma categoria)
      await pool.query(
        `DELETE FROM albums_categories WHERE album_id = $1`,
        [albumId]
      );
      
      // Inserir a nova associação
      const result = await pool.query(
        `INSERT INTO albums_categories (album_id, category_id, user_id, created_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING *`,
        [albumId, categoryId, userId]
      );
      
      console.log('✅ Album category association created');
      return result.rows[0];
      
    } catch (error: any) {
      console.error('❌ Error adding album category:', error.message);
      throw new Error(`Failed to add album category: ${error.message}`);
    }
  }

  /**
   * Obter categorias de um álbum
   */
  async getAlbumCategories(albumId: number): Promise<Category[]> {
    try {
      const result = await pool.query(
        `SELECT c.* 
         FROM Categories c 
         JOIN albums_categories ac ON c.id = ac.category_id
         WHERE ac.album_id = $1`,
        [albumId]
      );
      return result.rows;
    } catch (error: any) {
      console.error('❌ Error getting album categories:', error.message);
      throw new Error(`Failed to get album categories: ${error.message}`);
    }
  }

  /**
   * Remover categoria de um álbum
   */
  async removeAlbumCategory(albumId: number, categoryId: number, userId: string): Promise<boolean> {
    try {
      console.log('🗑️ Removing category', categoryId, 'from album', albumId);
      
      const result = await pool.query(
        `DELETE FROM albums_categories 
         WHERE album_id = $1 AND category_id = $2 AND user_id = $3`,
        [albumId, categoryId, userId]
      );
      
      return result.rowCount !== null && result.rowCount > 0;
      
    } catch (error: any) {
      console.error('❌ Error removing album category:', error.message);
      throw new Error(`Failed to remove album category: ${error.message}`);
    }
  }

  /**
   * Atualizar categoria de um álbum (remover antiga e adicionar nova)
   */
  async updateAlbumCategory(albumId: number, oldCategoryId: number, newCategoryId: number, userId: string): Promise<boolean> {
    try {
      console.log('🔄 Updating album', albumId, 'category from', oldCategoryId, 'to', newCategoryId);
      
      // Remover categoria antiga
      await this.removeAlbumCategory(albumId, oldCategoryId, userId);
      
      // Adicionar nova categoria
      await this.addAlbumCategory(albumId, newCategoryId, userId);
      
      console.log('✅ Album category updated successfully');
      return true;
      
    } catch (error: any) {
      console.error('❌ Error updating album category:', error.message);
      throw new Error(`Failed to update album category: ${error.message}`);
    }
  }

  /**
   * Obter uma categoria específica por ID
   */
  async getCategoryById(categoryId: number, userId: string): Promise<Category | null> {
    try {
      console.log('📂 Getting category by ID:', categoryId, 'for user:', userId);
      
      const query = `
        SELECT * FROM Categories 
        WHERE id = $1 AND user_id = $2
      `;
      
      const result = await pool.query(query, [categoryId, userId]);
      
      if (result.rows.length === 0) {
        console.log('❌ Category not found');
        return null;
      }
      
      console.log('✅ Category found:', result.rows[0]);
      return result.rows[0] as Category;
      
    } catch (error: any) {
      console.error('❌ Error getting category by ID:', error.message);
      throw new Error(`Failed to get category: ${error.message}`);
    }
  }

  /**
   * Atualizar uma categoria
   */
  async updateCategory(categoryId: number, categoryData: Partial<CreateCategoryData>, userId: string): Promise<Category> {
    try {
      console.log('📂 Updating category:', categoryId, 'for user:', userId);
      
      // Verificar se a categoria existe e pertence ao usuário
      const exists = await this.categoryExists(categoryId, userId);
      if (!exists) {
        throw new Error('Category not found or does not belong to user');
      }
      
      const updateFields = [];
      const values = [];
      let paramIndex = 1;
      
      if (categoryData.name) {
        updateFields.push(`name = $${paramIndex++}`);
        values.push(categoryData.name);
      }
      
      if (categoryData.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        values.push(categoryData.description);
      }
      
      if (categoryData.color !== undefined) {
        updateFields.push(`color = $${paramIndex++}`);
        values.push(categoryData.color);
      }
      
      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }
      
      values.push(categoryId, userId);
      
      const query = `
        UPDATE Categories 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
        RETURNING *
      `;
      
      const result = await pool.query(query, values);
      
      console.log('✅ Category updated successfully:', result.rows[0]);
      return result.rows[0] as Category;
      
    } catch (error: any) {
      console.error('❌ Error updating category:', error.message);
      throw new Error(`Failed to update category: ${error.message}`);
    }
  }

  /**
   * Deletar uma categoria
   */
  async deleteCategory(categoryId: number, userId: string): Promise<boolean> {
    try {
      console.log('📂 Deleting category:', categoryId, 'for user:', userId);
      
      // Verificar se a categoria existe e pertence ao usuário
      const exists = await this.categoryExists(categoryId, userId);
      if (!exists) {
        throw new Error('Category not found or does not belong to user');
      }
      
      // Primeiro, remover todas as associações album-categoria
      const deleteAssociationsQuery = `
        DELETE FROM albums_categories 
        WHERE category_id = $1 
        AND EXISTS (
          SELECT 1 FROM Albums 
          WHERE Albums.id = albums_categories.album_id 
          AND Albums.user_id = $2
        )
      `;
      
      await pool.query(deleteAssociationsQuery, [categoryId, userId]);
      
      // Depois, deletar a categoria
      const deleteCategoryQuery = `
        DELETE FROM Categories 
        WHERE id = $1 AND user_id = $2
      `;
      
      const result = await pool.query(deleteCategoryQuery, [categoryId, userId]);
      
      if (result.rowCount === 0) {
        throw new Error('Category not found or could not be deleted');
      }
      
      console.log('✅ Category deleted successfully');
      return true;
      
    } catch (error: any) {
      console.error('❌ Error deleting category:', error.message);
      throw new Error(`Failed to delete category: ${error.message}`);
    }
  }
}
