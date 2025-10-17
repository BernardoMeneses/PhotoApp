"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoriesService = void 0;
const database_1 = require("../../config/database");
class CategoriesService {
    async createCategory(userId, categoryData) {
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
            const result = await database_1.pool.query(query, values);
            console.log('✅ Category created successfully:', result.rows[0]);
            return result.rows[0];
        }
        catch (error) {
            console.error('❌ Error creating category:', error.message);
            throw new Error(`Failed to create category: ${error.message}`);
        }
    }
    async getUserCategories(userId) {
        try {
            console.log('📋 Getting categories for user:', userId);
            const query = `
        SELECT * FROM Categories 
        WHERE user_id = $1 
        ORDER BY name ASC
      `;
            const result = await database_1.pool.query(query, [userId]);
            console.log(`✅ Found ${result.rows.length} categories for user`);
            return result.rows;
        }
        catch (error) {
            console.error('❌ Error getting user categories:', error.message);
            throw new Error(`Failed to get categories: ${error.message}`);
        }
    }
    async categoryExists(categoryId, userId) {
        try {
            const query = `
        SELECT id FROM Categories 
        WHERE id = $1 AND user_id = $2
      `;
            const result = await database_1.pool.query(query, [categoryId, userId]);
            return result.rows.length > 0;
        }
        catch (error) {
            return false;
        }
    }
    async addAlbumCategory(albumId, categoryId, userId) {
        try {
            console.log('🔗 Adding album', albumId, 'to category', categoryId);
            await database_1.pool.query(`DELETE FROM albums_categories WHERE album_id = $1`, [albumId]);
            const result = await database_1.pool.query(`INSERT INTO albums_categories (album_id, category_id, user_id, created_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING *`, [albumId, categoryId, userId]);
            console.log('✅ Album category association created');
            return result.rows[0];
        }
        catch (error) {
            console.error('❌ Error adding album category:', error.message);
            throw new Error(`Failed to add album category: ${error.message}`);
        }
    }
    async getAlbumCategories(albumId) {
        try {
            const result = await database_1.pool.query(`SELECT c.* 
         FROM Categories c 
         JOIN albums_categories ac ON c.id = ac.category_id
         WHERE ac.album_id = $1`, [albumId]);
            return result.rows;
        }
        catch (error) {
            console.error('❌ Error getting album categories:', error.message);
            throw new Error(`Failed to get album categories: ${error.message}`);
        }
    }
    async removeAlbumCategory(albumId, categoryId, userId) {
        try {
            console.log('🗑️ Removing category', categoryId, 'from album', albumId);
            const result = await database_1.pool.query(`DELETE FROM albums_categories 
         WHERE album_id = $1 AND category_id = $2 AND user_id = $3`, [albumId, categoryId, userId]);
            return result.rowCount !== null && result.rowCount > 0;
        }
        catch (error) {
            console.error('❌ Error removing album category:', error.message);
            throw new Error(`Failed to remove album category: ${error.message}`);
        }
    }
    async updateAlbumCategory(albumId, oldCategoryId, newCategoryId, userId) {
        try {
            console.log('🔄 Updating album', albumId, 'category from', oldCategoryId, 'to', newCategoryId);
            await this.removeAlbumCategory(albumId, oldCategoryId, userId);
            await this.addAlbumCategory(albumId, newCategoryId, userId);
            console.log('✅ Album category updated successfully');
            return true;
        }
        catch (error) {
            console.error('❌ Error updating album category:', error.message);
            throw new Error(`Failed to update album category: ${error.message}`);
        }
    }
    async getCategoryById(categoryId, userId) {
        try {
            console.log('📂 Getting category by ID:', categoryId, 'for user:', userId);
            const query = `
        SELECT * FROM Categories 
        WHERE id = $1 AND user_id = $2
      `;
            const result = await database_1.pool.query(query, [categoryId, userId]);
            if (result.rows.length === 0) {
                console.log('❌ Category not found');
                return null;
            }
            console.log('✅ Category found:', result.rows[0]);
            return result.rows[0];
        }
        catch (error) {
            console.error('❌ Error getting category by ID:', error.message);
            throw new Error(`Failed to get category: ${error.message}`);
        }
    }
    async updateCategory(categoryId, categoryData, userId) {
        try {
            console.log('📂 Updating category:', categoryId, 'for user:', userId);
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
            const result = await database_1.pool.query(query, values);
            console.log('✅ Category updated successfully:', result.rows[0]);
            return result.rows[0];
        }
        catch (error) {
            console.error('❌ Error updating category:', error.message);
            throw new Error(`Failed to update category: ${error.message}`);
        }
    }
    async deleteCategory(categoryId, userId) {
        try {
            console.log('📂 Deleting category:', categoryId, 'for user:', userId);
            const exists = await this.categoryExists(categoryId, userId);
            if (!exists) {
                throw new Error('Category not found or does not belong to user');
            }
            const deleteAssociationsQuery = `
        DELETE FROM albums_categories 
        WHERE category_id = $1 
        AND EXISTS (
          SELECT 1 FROM Albums 
          WHERE Albums.id = albums_categories.album_id 
          AND Albums.user_id = $2
        )
      `;
            await database_1.pool.query(deleteAssociationsQuery, [categoryId, userId]);
            const deleteCategoryQuery = `
        DELETE FROM Categories 
        WHERE id = $1 AND user_id = $2
      `;
            const result = await database_1.pool.query(deleteCategoryQuery, [categoryId, userId]);
            if (result.rowCount === 0) {
                throw new Error('Category not found or could not be deleted');
            }
            console.log('✅ Category deleted successfully');
            return true;
        }
        catch (error) {
            console.error('❌ Error deleting category:', error.message);
            throw new Error(`Failed to delete category: ${error.message}`);
        }
    }
}
exports.CategoriesService = CategoriesService;
//# sourceMappingURL=categories.service.js.map