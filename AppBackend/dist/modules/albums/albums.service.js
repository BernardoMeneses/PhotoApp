"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlbumsService = void 0;
const database_1 = require("../../config/database");
const users_service_1 = require("../users/users.service");
const categories_service_1 = require("../categories/categories.service");
class AlbumsService {
    constructor() {
        this.usersService = new users_service_1.UsersService();
        this.categoriesService = new categories_service_1.CategoriesService();
    }
    async createAlbum(userId, userEmail, albumData) {
        try {
            console.log('📁 Creating album for user:', userId, userEmail);
            await this.usersService.ensureUserExists(userId, userEmail);
            console.log('✅ User verified/created in database');
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
            const result = await database_1.pool.query(query, values);
            const album = result.rows[0];
            if (albumData.categoryId) {
                console.log('🏷️ Creating album-category association');
                await this.categoriesService.addAlbumCategory(album.id, albumData.categoryId, userId);
                const category = await this.categoriesService.getCategoryById(albumData.categoryId, userId);
                if (category) {
                    album.category = category;
                    console.log('✅ Album created with category:', category.name);
                }
            }
            console.log('✅ Album created successfully:', album);
            return album;
        }
        catch (error) {
            console.error('❌ Error creating album:', error.message);
            throw new Error(`Failed to create album: ${error.message}`);
        }
    }
    async getUserAlbums(userId) {
        try {
            console.log('📋 Getting albums for user:', userId);
            const query = `
        SELECT * FROM Albums 
        WHERE user_id = $1 
        ORDER BY created_at DESC
      `;
            const result = await database_1.pool.query(query, [userId]);
            console.log(`✅ Found ${result.rows.length} Albums for user`);
            return result.rows;
        }
        catch (error) {
            console.error('❌ Error getting user albums:', error.message);
            throw new Error(`Failed to get albums: ${error.message}`);
        }
    }
    async getUserAlbumsWithCategories(userId) {
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
            const result = await database_1.pool.query(query, [userId]);
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
        }
        catch (error) {
            console.error('❌ Error getting user albums with categories:', error.message);
            throw new Error(`Failed to get albums with categories: ${error.message}`);
        }
    }
    async getAlbumById(albumId, userId) {
        try {
            console.log('📖 Getting album:', albumId, 'for user:', userId);
            const query = `
        SELECT * FROM Albums 
        WHERE id = $1 AND user_id = $2
      `;
            const result = await database_1.pool.query(query, [albumId, userId]);
            if (result.rows.length === 0) {
                console.log('❌ Album not found or access denied');
                return null;
            }
            console.log('✅ Album found:', result.rows[0]);
            return result.rows[0];
        }
        catch (error) {
            console.error('❌ Error getting album:', error.message);
            throw new Error(`Failed to get album: ${error.message}`);
        }
    }
    async updateAlbum(albumId, userId, updateData) {
        try {
            console.log('✏️ Updating album:', albumId, 'for user:', userId);
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
            let album = null;
            if (fields.length > 0) {
                values.push(albumId, userId);
                const query = `
          UPDATE Albums 
          SET ${fields.join(', ')}
          WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
          RETURNING *
        `;
                const result = await database_1.pool.query(query, values);
                if (result.rows.length === 0) {
                    console.log('❌ Album not found or access denied');
                    return null;
                }
                album = result.rows[0];
                console.log('✅ Album updated:', album);
            }
            else {
                const getAlbumQuery = `SELECT * FROM Albums WHERE id = $1 AND user_id = $2`;
                const getResult = await database_1.pool.query(getAlbumQuery, [albumId, userId]);
                if (getResult.rows.length === 0) {
                    console.log('❌ Album not found or access denied');
                    return null;
                }
                album = getResult.rows[0];
            }
            if (updateData.categoryId !== undefined) {
                console.log('🏷️ Updating album category');
                await database_1.pool.query(`DELETE FROM albums_categories WHERE album_id = $1`, [albumId]);
                if (updateData.categoryId !== null) {
                    await this.categoriesService.addAlbumCategory(albumId, updateData.categoryId, userId);
                    const category = await this.categoriesService.getCategoryById(updateData.categoryId, userId);
                    if (category) {
                        album.category = category;
                        console.log('✅ Album category updated to:', category.name);
                    }
                }
                else {
                    console.log('✅ Album category removed');
                    album.category = null;
                }
            }
            return album;
        }
        catch (error) {
            console.error('❌ Error updating album:', error.message);
            throw new Error(`Failed to update album: ${error.message}`);
        }
    }
    async deleteAlbum(albumId, userId) {
        try {
            console.log('🗑️ Deleting album:', albumId, 'for user:', userId);
            const query = `
        DELETE FROM Albums 
        WHERE id = $1 AND user_id = $2
      `;
            const result = await database_1.pool.query(query, [albumId, userId]);
            if (result.rowCount === 0) {
                console.log('❌ Album not found or access denied');
                return false;
            }
            console.log('✅ Album deleted successfully');
            return true;
        }
        catch (error) {
            console.error('❌ Error deleting album:', error.message);
            throw new Error(`Failed to delete album: ${error.message}`);
        }
    }
    async getRandomUserPhoto(userId) {
        try {
            console.log('🖼️ Getting random photo for user:', userId);
            return null;
        }
        catch (error) {
            console.error('❌ Error getting random photo:', error.message);
            return null;
        }
    }
    async addPhotoToAlbum(albumId, userId, photoName, photoUrl) {
        const query = `
    INSERT INTO albumphotos (album_id, user_id, photo_name, photo_url)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
        const result = await database_1.pool.query(query, [albumId, userId, photoName, photoUrl]);
        return result.rows[0];
    }
    async getAlbumPhotos(albumId, userId) {
        const query = `
    SELECT * FROM albumphotos
    WHERE album_id = $1 AND user_id = $2
    ORDER BY created_at DESC;
  `;
        const result = await database_1.pool.query(query, [albumId, userId]);
        return result.rows;
    }
    async removePhotoFromAlbum(albumId, userId, photoName) {
        const query = `
    DELETE FROM albumphotos
    WHERE album_id = $1 AND user_id = $2 AND photo_name = $3
  `;
        const result = await database_1.pool.query(query, [albumId, userId, photoName]);
        return result.rowCount !== null && result.rowCount > 0;
    }
    async getAlbumWithCategories(albumId, userId) {
        const album = await this.getAlbumById(albumId, userId);
        if (!album)
            return null;
        const categories = await database_1.pool.query(`SELECT c.id, c.name 
     FROM categories c 
     JOIN albums_categories ac ON ac.category_id = c.id 
     WHERE ac.album_id = $1`, [albumId]);
        return { ...album, categories: categories.rows };
    }
    async batchAddPhotosToAlbum(albumId, userId, photos) {
        const results = {
            success: [],
            failed: []
        };
        for (const photo of photos) {
            try {
                const addedPhoto = await this.addPhotoToAlbum(albumId, userId, photo.photoName, photo.photoUrl);
                results.success.push(addedPhoto);
            }
            catch (error) {
                console.error(`❌ Failed to add photo ${photo.photoName} to album:`, error.message);
                results.failed.push({
                    photoName: photo.photoName,
                    error: error.message
                });
            }
        }
        return results;
    }
    async close() {
        await database_1.pool.end();
    }
}
exports.AlbumsService = AlbumsService;
//# sourceMappingURL=albums.service.js.map