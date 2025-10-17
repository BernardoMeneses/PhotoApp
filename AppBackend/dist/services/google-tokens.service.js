"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleTokensService = void 0;
const database_1 = require("../config/database");
class GoogleTokensService {
    async saveUserTokens(userId, tokens) {
        try {
            const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
            const query = `
        INSERT INTO user_google_tokens (user_id, access_token, refresh_token, expires_at, scope)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          expires_at = EXCLUDED.expires_at,
          scope = EXCLUDED.scope,
          updated_at = CURRENT_TIMESTAMP
      `;
            await database_1.pool.query(query, [
                userId,
                tokens.access_token,
                tokens.refresh_token || null,
                expiresAt,
                tokens.scope || null
            ]);
            console.log('✅ Google tokens saved for user:', userId);
        }
        catch (error) {
            console.error('❌ Error saving Google tokens:', error);
            throw new Error('Failed to save Google tokens');
        }
    }
    async getUserTokens(userId) {
        try {
            const query = `
        SELECT user_id, access_token, refresh_token, expires_at, scope, created_at, updated_at
        FROM user_google_tokens 
        WHERE user_id = $1
      `;
            const result = await database_1.pool.query(query, [userId]);
            if (result.rows.length === 0) {
                return null;
            }
            const row = result.rows[0];
            return {
                userId: row.user_id,
                accessToken: row.access_token,
                refreshToken: row.refresh_token,
                expiresAt: row.expires_at,
                scope: row.scope,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };
        }
        catch (error) {
            console.error('❌ Error getting Google tokens:', error);
            throw new Error('Failed to get Google tokens');
        }
    }
    async hasValidTokens(userId) {
        try {
            const tokens = await this.getUserTokens(userId);
            if (!tokens) {
                return false;
            }
            if (tokens.expiresAt && tokens.expiresAt < new Date()) {
                return !!tokens.refreshToken;
            }
            return true;
        }
        catch (error) {
            console.error('❌ Error checking Google tokens validity:', error);
            return false;
        }
    }
    async removeUserTokens(userId) {
        try {
            const query = `DELETE FROM user_google_tokens WHERE user_id = $1`;
            await database_1.pool.query(query, [userId]);
            console.log('✅ Google tokens removed for user:', userId);
        }
        catch (error) {
            console.error('❌ Error removing Google tokens:', error);
            throw new Error('Failed to remove Google tokens');
        }
    }
    async getAllUsersWithTokens() {
        try {
            const query = `SELECT user_id FROM user_google_tokens ORDER BY created_at DESC`;
            const result = await database_1.pool.query(query);
            return result.rows.map(row => row.user_id);
        }
        catch (error) {
            console.error('❌ Error getting users with tokens:', error);
            throw new Error('Failed to get users with tokens');
        }
    }
}
exports.GoogleTokensService = GoogleTokensService;
//# sourceMappingURL=google-tokens.service.js.map