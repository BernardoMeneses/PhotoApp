"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const database_1 = require("../../config/database");
class UsersService {
    async userExists(userId) {
        try {
            const query = 'SELECT id FROM Users WHERE id = $1';
            const result = await database_1.pool.query(query, [userId]);
            return result.rows.length > 0;
        }
        catch (error) {
            console.error('❌ Error checking if user exists:', error.message);
            throw new Error(`Failed to check user existence: ${error.message}`);
        }
    }
    async getUserById(userId) {
        try {
            const query = 'SELECT * FROM Users WHERE id = $1';
            const result = await database_1.pool.query(query, [userId]);
            if (result.rows.length === 0) {
                return null;
            }
            return result.rows[0];
        }
        catch (error) {
            console.error('❌ Error getting user by ID:', error.message);
            throw new Error(`Failed to get user: ${error.message}`);
        }
    }
    async createUser(userData) {
        try {
            console.log('👤 Creating user:', userData.email);
            const query = `
        INSERT INTO Users (id, email, password_hash, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING *
      `;
            const values = [
                userData.id,
                userData.email,
                userData.password_hash || 'FIREBASE_AUTH'
            ];
            const result = await database_1.pool.query(query, values);
            console.log('✅ User created successfully:', result.rows[0]);
            return result.rows[0];
        }
        catch (error) {
            console.error('❌ Error creating user:', error.message);
            throw new Error(`Failed to create user: ${error.message}`);
        }
    }
    async ensureUserExists(userId, email) {
        try {
            let user = await this.getUserById(userId);
            if (user) {
                console.log('✅ User already exists in database:', user.email);
                return user;
            }
            console.log('🆕 User not found, creating new user:', email);
            user = await this.createUser({
                id: userId,
                email: email
            });
            return user;
        }
        catch (error) {
            console.error('❌ Error ensuring user exists:', error.message);
            throw new Error(`Failed to ensure user exists: ${error.message}`);
        }
    }
    async updateUserEmail(userId, newEmail) {
        try {
            console.log('📧 Updating user email:', userId, newEmail);
            const query = `
        UPDATE Users 
        SET email = $2
        WHERE id = $1
        RETURNING *
      `;
            const result = await database_1.pool.query(query, [userId, newEmail]);
            if (result.rows.length === 0) {
                return null;
            }
            console.log('✅ User email updated successfully');
            return result.rows[0];
        }
        catch (error) {
            console.error('❌ Error updating user email:', error.message);
            throw new Error(`Failed to update user email: ${error.message}`);
        }
    }
}
exports.UsersService = UsersService;
//# sourceMappingURL=users.service.js.map