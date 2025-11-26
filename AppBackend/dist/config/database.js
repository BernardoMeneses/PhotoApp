"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTables = exports.testConnection = exports.pool = void 0;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'photoapp',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};
exports.pool = new pg_1.Pool(dbConfig);
const testConnection = async () => {
    try {
        const client = await exports.pool.connect();
        console.log('✅ Database connected successfully');
        client.release();
    }
    catch (error) {
        console.error('❌ Database connection failed:', error);
        throw error;
    }
};
exports.testConnection = testConnection;
const createTables = async () => {
    const client = await exports.pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS Albums (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                title VARCHAR(255) NOT NULL,
                hexcolor VARCHAR(7) NOT NULL,
                year INTEGER,
                coverimage VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS albumphotos (
                id SERIAL PRIMARY KEY,
                album_id INTEGER NOT NULL,
                user_id VARCHAR(255) NOT NULL,
                photo_name VARCHAR(500) NOT NULL,
                photo_url TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS photo_metadata (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                photo_id VARCHAR(255) NOT NULL, -- ID da foto no Google Drive
                photo_name VARCHAR(500) NOT NULL,
                photo_url TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'unsorted', -- 'unsorted', 'library', ou 'album'
                created_time TIMESTAMP,
                moved_to_library_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, photo_id) -- Evitar duplicados
            )
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_albumphotos_album_id ON albumphotos(album_id)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_albumphotos_user_id ON albumphotos(user_id)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_photo_metadata_user_status ON photo_metadata(user_id, status)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_photo_metadata_photo_id ON photo_metadata(photo_id)
        `);
        console.log('✅ Tables created successfully');
    }
    catch (error) {
        console.error('❌ Error creating tables:', error);
        throw error;
    }
    finally {
        client.release();
    }
};
exports.createTables = createTables;
//# sourceMappingURL=database.js.map