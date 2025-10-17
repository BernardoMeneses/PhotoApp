import { pool } from '../../config/database';

export interface User {
  id: string; // Firebase UID
  email: string;
  password_hash?: string;
  created_at: Date;
}

export interface CreateUserData {
  id: string; // Firebase UID
  email: string;
  password_hash?: string;
}

export class UsersService {
  
  /**
   * Verificar se um usuário existe na base de dados
   */
  async userExists(userId: string): Promise<boolean> {
    try {
      const query = 'SELECT id FROM Users WHERE id = $1';
      const result = await pool.query(query, [userId]);
      return result.rows.length > 0;
    } catch (error: any) {
      console.error('❌ Error checking if user exists:', error.message);
      throw new Error(`Failed to check user existence: ${error.message}`);
    }
  }

  /**
   * Obter um usuário por ID
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      const query = 'SELECT * FROM Users WHERE id = $1';
      const result = await pool.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error: any) {
      console.error('❌ Error getting user by ID:', error.message);
      throw new Error(`Failed to get user: ${error.message}`);
    }
  }

  /**
   * Criar um novo usuário na base de dados
   */
  async createUser(userData: CreateUserData): Promise<User> {
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

      const result = await pool.query(query, values);
      
      console.log('✅ User created successfully:', result.rows[0]);
      return result.rows[0];
      
    } catch (error: any) {
      console.error('❌ Error creating user:', error.message);
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  /**
   * Garantir que um usuário existe na base de dados
   * Se não existir, cria com dados do Firebase
   */
  async ensureUserExists(userId: string, email: string): Promise<User> {
    try {
      // Verificar se já existe
      let user = await this.getUserById(userId);
      
      if (user) {
        console.log('✅ User already exists in database:', user.email);
        return user;
      }

      // Se não existe, criar
      console.log('🆕 User not found, creating new user:', email);
      user = await this.createUser({
        id: userId,
        email: email
      });

      return user;
      
    } catch (error: any) {
      console.error('❌ Error ensuring user exists:', error.message);
      throw new Error(`Failed to ensure user exists: ${error.message}`);
    }
  }

  /**
   * Atualizar email do usuário
   */
  async updateUserEmail(userId: string, newEmail: string): Promise<User | null> {
    try {
      console.log('📧 Updating user email:', userId, newEmail);
      
      const query = `
        UPDATE Users 
        SET email = $2
        WHERE id = $1
        RETURNING *
      `;

      const result = await pool.query(query, [userId, newEmail]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      console.log('✅ User email updated successfully');
      return result.rows[0];
      
    } catch (error: any) {
      console.error('❌ Error updating user email:', error.message);
      throw new Error(`Failed to update user email: ${error.message}`);
    }
  }
}