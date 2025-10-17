"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = initializeDatabase;
const database_1 = require("./database");
async function initializeDatabase() {
    try {
        console.log('🔧 Initializing database...');
        await database_1.pool.query('DROP TABLE IF EXISTS albums');
        await database_1.pool.query('DROP TABLE IF EXISTS Albums CASCADE');
        await database_1.pool.query('DROP TABLE IF EXISTS Users CASCADE');
        console.log('🗑️ Dropped old tables if they existed');
        const createUsersTable = `
      CREATE TABLE IF NOT EXISTS Users (
        id VARCHAR(255) PRIMARY KEY, -- Firebase UID
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT, -- pode ser null se usar apenas Firebase auth
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
        await database_1.pool.query(createUsersTable);
        console.log('✅ Users table created successfully');
        const createAlbumsTable = `
      CREATE TABLE IF NOT EXISTS Albums (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        hexcolor VARCHAR(7) NOT NULL,
        coverimage TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
      )
    `;
        await database_1.pool.query(createAlbumsTable);
        console.log('✅ Albums table created successfully');
        const createUsersEmailIndex = `
      CREATE INDEX IF NOT EXISTS idx_users_email ON Users(email)
    `;
        const createAlbumsUserIndex = `
      CREATE INDEX IF NOT EXISTS idx_albums_user_id ON Albums(user_id)
    `;
        await database_1.pool.query(createUsersEmailIndex);
        await database_1.pool.query(createAlbumsUserIndex);
        console.log('✅ Database indexes created successfully');
        console.log('🎉 Database initialization completed!');
    }
    catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        throw error;
    }
}
//# sourceMappingURL=init-database.js.map