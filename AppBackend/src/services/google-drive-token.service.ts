import { pool } from '../config/database';
import { googleDriveService } from './google-drive.service';

interface GoogleDriveTokens {
  user_id: string;
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expiry_date?: number;
  scope?: string;
  created_at?: Date;
  updated_at?: Date;
}

export class GoogleDriveTokenService {
  /**
   * Criar tabela se não existir
   */
  static async createTableIfNotExists(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS google_drive_tokens (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) UNIQUE NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        token_type VARCHAR(50),
        expiry_date BIGINT,
        scope TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    try {
      await pool.query(createTableQuery);
    } catch (error: any) {
      console.error('❌ Erro ao criar tabela google_drive_tokens:', error.message);
      throw error;
    }
  }

  /**
   * Salvar tokens do Google Drive para um usuário
   */
  static async saveTokens(userId: string, tokens: any): Promise<void> {
    const query = `
      INSERT INTO google_drive_tokens (user_id, access_token, refresh_token, token_type, expiry_date, scope, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        access_token = EXCLUDED.access_token,
        refresh_token = COALESCE(EXCLUDED.refresh_token, google_drive_tokens.refresh_token),
        token_type = EXCLUDED.token_type,
        expiry_date = EXCLUDED.expiry_date,
        scope = EXCLUDED.scope,
        updated_at = CURRENT_TIMESTAMP;
    `;

    try {
      await pool.query(query, [
        userId,
        tokens.access_token,
        tokens.refresh_token,
        tokens.token_type || 'Bearer',
        tokens.expiry_date,
        tokens.scope
      ]);

      console.log(`💾 Tokens salvos para usuário: ${userId}`);
    } catch (error: any) {
      console.error('❌ Erro ao salvar tokens:', error.message);
      throw new Error('Failed to save Google Drive tokens');
    }
  }

  /**
   * Carregar tokens do Google Drive de um usuário
   */
  static async loadTokens(userId: string): Promise<GoogleDriveTokens | null> {
    const query = `
      SELECT * FROM google_drive_tokens 
      WHERE user_id = $1;
    `;

    try {
      const result = await pool.query(query, [userId]);
      
      if (result.rows.length === 0) {
        console.log(`📭 Nenhum token encontrado para usuário: ${userId}`);
        return null;
      }

      const tokenData = result.rows[0];
      console.log(`🔑 Tokens carregados para usuário: ${userId}`);

      return {
        user_id: tokenData.user_id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type,
        expiry_date: tokenData.expiry_date,
        scope: tokenData.scope,
        created_at: tokenData.created_at,
        updated_at: tokenData.updated_at
      };
    } catch (error: any) {
      console.error('❌ Erro ao carregar tokens:', error.message);
      throw new Error('Failed to load Google Drive tokens');
    }
  }

  /**
   * Obter tokens válidos (com refresh automático se expirados)
   */
  static async getValidTokens(userId: string): Promise<GoogleDriveTokens | null> {
    const tokens = await this.loadTokens(userId);
    
    if (!tokens) {
      console.log(`📭 Nenhum token encontrado para usuário: ${userId}`);
      return null;
    }

    // Verificar se o token está expirado ou prestes a expirar (5 minutos de margem)
    const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
    const isExpired = tokens.expiry_date && tokens.expiry_date < fiveMinutesFromNow;

    if (isExpired) {
      console.log(`⏰ Token expirado para usuário ${userId}, fazendo refresh...`);
      
      if (!tokens.refresh_token) {
        console.error('❌ Sem refresh_token disponível, usuário precisa reconectar');
        throw new Error('Token expirado e sem refresh_token. Por favor, reconecte o Google Drive.');
      }

      try {
        // Fazer refresh dos tokens
        const newTokens = await googleDriveService.refreshTokens(tokens.refresh_token);
        
        // Atualizar na base de dados
        await this.updateAccessToken(
          userId, 
          newTokens.access_token, 
          newTokens.expiry_date
        );

        console.log(`✅ Token refreshed com sucesso para usuário ${userId}`);
        
        // Retornar tokens atualizados
        return {
          ...tokens,
          access_token: newTokens.access_token,
          expiry_date: newTokens.expiry_date
        };
      } catch (error: any) {
        console.error(`❌ Erro ao fazer refresh do token: ${error.message}`);
        throw new Error('Falha ao renovar token. Por favor, reconecte o Google Drive.');
      }
    }

    console.log(`✅ Token válido para usuário ${userId}`);
    return tokens;
  }

  /**
   * Verificar se usuário tem tokens do Google Drive
   */
  static async hasTokens(userId: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM google_drive_tokens 
      WHERE user_id = $1;
    `;

    try {
      const result = await pool.query(query, [userId]);
      return result.rows.length > 0;
    } catch (error: any) {
      console.error('❌ Erro ao verificar tokens:', error.message);
      return false;
    }
  }

  /**
   * Deletar tokens do Google Drive de um usuário
   */
  static async deleteTokens(userId: string): Promise<boolean> {
    const query = `
      DELETE FROM google_drive_tokens 
      WHERE user_id = $1;
    `;

    try {
      const result = await pool.query(query, [userId]);
      console.log(`🗑️ Tokens deletados para usuário: ${userId}`);
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error: any) {
      console.error('❌ Erro ao deletar tokens:', error.message);
      return false;
    }
  }

  /**
   * Atualizar apenas o access_token (após refresh)
   */
  static async updateAccessToken(userId: string, accessToken: string, expiryDate?: number): Promise<void> {
    const query = `
      UPDATE google_drive_tokens 
      SET access_token = $2, expiry_date = $3, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1;
    `;

    try {
      await pool.query(query, [userId, accessToken, expiryDate]);
      console.log(`🔄 Access token atualizado para usuário: ${userId}`);
    } catch (error: any) {
      console.error('❌ Erro ao atualizar access token:', error.message);
      throw new Error('Failed to update access token');
    }
  }

  /**
   * Listar todos os usuários que têm tokens
   */
  static async getUsersWithTokens(): Promise<string[]> {
    const query = `
      SELECT user_id FROM google_drive_tokens;
    `;

    try {
      const result = await pool.query(query);
      return result.rows.map(row => row.user_id);
    } catch (error: any) {
      console.error('❌ Erro ao listar usuários com tokens:', error.message);
      return [];
    }
  }

  /**
   * Verificar se tokens estão próximos do vencimento (menos de 5 minutos)
   */
  static async getExpiredTokens(): Promise<string[]> {
    const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000); // 5 minutos em ms
    
    const query = `
      SELECT user_id FROM google_drive_tokens 
      WHERE expiry_date IS NOT NULL AND expiry_date < $1;
    `;

    try {
      const result = await pool.query(query, [fiveMinutesFromNow]);
      return result.rows.map(row => row.user_id);
    } catch (error: any) {
      console.error('❌ Erro ao verificar tokens expirados:', error.message);
      return [];
    }
  }
}

// Inicializar tabela quando o módulo é carregado
GoogleDriveTokenService.createTableIfNotExists().catch(console.error);