import { Pool } from 'pg';
import dotenv from 'dotenv';

// Carregar as variáveis do .env
dotenv.config();

// Configuração da pool de conexões PostgreSQL
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'photoapp',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    max: 20, // Máximo de conexões na pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

// Criar a pool de conexões
export const pool = new Pool(dbConfig);

// Função para testar a conexão
export const testConnection = async (): Promise<void> => {
    try {
        const client = await pool.connect();
        console.log('✅ Database connected successfully');
        client.release();
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        throw error;
    }
};

// Função para criar as tabelas necessárias
export const createTables = async (): Promise<void> => {
    const client = await pool.connect();
    try {
        // Criar tabela de álbuns
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

        // Criar tabela albumphotos para relacionar álbuns com fotos
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

        // Criar índices para melhor performance
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_albumphotos_album_id ON albumphotos(album_id)
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_albumphotos_user_id ON albumphotos(user_id)
        `);

        console.log('✅ Tables created successfully');
    } catch (error) {
        console.error('❌ Error creating tables:', error);
        throw error;
    } finally {
        client.release();
    }
};