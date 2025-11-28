import { pool } from "../../config/database";
import { GoogleDriveService } from "../../services/google-drive.service";
import axios from "axios";

interface FirebaseUserData {
  localId: string;
  email: string;
  emailVerified: boolean;
  providerUserInfo: any[];
  validSince: string;
  disabled: boolean;
  lastLoginAt: string;
  createdAt: string;
}

interface UpdateProfileData {
  email?: string;
  password?: string;
  displayName?: string;
}

export class ProfileService {
  /**
   * Obter uso do Google Drive do usuário autenticado
   */
  static async getGoogleDriveUsage(userId: string): Promise<{ used: number; total: number }> {
    if (!userId) throw new Error("User not authenticated");
    // Buscar tokens do utilizador na base de dados
    const result = await pool.query(
      "SELECT google_drive_access_token, google_drive_refresh_token FROM users WHERE id = $1",
      [userId]
    );
    const row = result.rows[0];
    if (!row || !row.google_drive_access_token) {
      throw new Error("Google Drive not connected");
    }
    const tokens = {
      access_token: row.google_drive_access_token,
      refresh_token: row.google_drive_refresh_token,
    };
    // Chamar Google API para obter uso
    const googleDriveService = new GoogleDriveService();
    const drive = (googleDriveService as any)["createDriveClient"](tokens);
    const about = await drive.about.get({ fields: "storageQuota" });
    console.log("[GoogleDrive] about.data:", about.data);
    const quota = about.data.storageQuota;
    if (!quota) {
      throw new Error("Não foi possível obter a quota do Google Drive. Verifique se a conta está conectada corretamente e se o token tem permissão.");
    }
    return {
      used: Number(quota.usage || 0),
      total: Number(quota.limit || 15 * 1024 * 1024 * 1024), // fallback 15GB
    };
  }
  /**
   * Buscar dados do perfil atual do Firebase
   */
  static async getCurrentProfile(idToken: string): Promise<FirebaseUserData> {
    try {
      const apiKey = process.env.FIREBASE_API_KEY;
      if (!apiKey) {
        throw new Error("FIREBASE_API_KEY is not defined in environment variables");
      }

      const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      
      const response = await axios.post(url, {
        idToken: idToken
      });

      if (!response.data.users || response.data.users.length === 0) {
        throw new Error("User not found");
      }

      return response.data.users[0];
    } catch (error: any) {
      if (error.response?.data?.error) {
        const firebaseError = error.response.data.error;
        
        switch (firebaseError.message) {
          case 'INVALID_ID_TOKEN':
            throw new Error("Invalid or expired token");
          case 'USER_NOT_FOUND':
            throw new Error("User not found");
          default:
            throw new Error(`Firebase error: ${firebaseError.message}`);
        }
      }
      
      throw new Error("Failed to fetch user profile");
    }
  }

  /**
   * Atualizar perfil do usuário no Firebase
   */
  static async updateProfile(idToken: string, updateData: UpdateProfileData): Promise<FirebaseUserData> {
    try {
      const apiKey = process.env.FIREBASE_API_KEY;
      if (!apiKey) {
        throw new Error("FIREBASE_API_KEY is not defined in environment variables");
      }

      const url = `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`;
      
      const requestData: any = {
        idToken: idToken,
        returnSecureToken: true
      };

      // Adicionar campos que serão atualizados
      if (updateData.email) {
        requestData.email = updateData.email;
      }
      
      if (updateData.password) {
        requestData.password = updateData.password;
      }
      
      const response = await axios.post(url, requestData);

      return {
        localId: response.data.localId,
        email: response.data.email,
        emailVerified: response.data.emailVerified || false,
        providerUserInfo: response.data.providerUserInfo || [],
        validSince: response.data.validSince || "",
        disabled: false,
        lastLoginAt: response.data.lastLoginAt || "",
        createdAt: response.data.createdAt || ""
      };
    } catch (error: any) {
      if (error.response?.data?.error) {
        const firebaseError = error.response.data.error;
        
        switch (firebaseError.message) {
          case 'INVALID_ID_TOKEN':
            throw new Error("Invalid or expired token");
          case 'EMAIL_EXISTS':
            throw new Error("Email already exists");
          case 'WEAK_PASSWORD':
            throw new Error("Password is too weak");
          case 'INVALID_EMAIL':
            throw new Error("Invalid email format");
          case 'USER_NOT_FOUND':
            throw new Error("User not found");
          default:
            throw new Error(`Firebase error: ${firebaseError.message}`);
        }
      }
      
      throw new Error("Failed to update user profile");
    }
  }

  /**
   * Atualizar apenas email
   */
  static async updateEmail(idToken: string, newEmail: string): Promise<FirebaseUserData> {
    return this.updateProfile(idToken, { email: newEmail });
  }

  /**
   * Atualizar apenas password
   * Requer a password atual para validação de segurança
   */
  static async updatePassword(idToken: string, currentPassword: string, newPassword: string): Promise<{ idToken: string; userData: FirebaseUserData }> {
    try {
      const apiKey = process.env.FIREBASE_API_KEY;
      if (!apiKey) {
        throw new Error("FIREBASE_API_KEY is not defined in environment variables");
      }

      // Primeiro, obter o email do usuário atual
      const currentProfile = await this.getCurrentProfile(idToken);
      
      // Validar a password atual fazendo login
      const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
      
      await axios.post(signInUrl, {
        email: currentProfile.email,
        password: currentPassword,
        returnSecureToken: true
      });

      // Se chegou aqui, a password atual está correta
      // Agora atualizar para a nova password
      const updateUrl = `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`;
      
      const response = await axios.post(updateUrl, {
        idToken: idToken,
        password: newPassword,
        returnSecureToken: true
      });

      // Retornar novo token e dados do usuário
      return {
        idToken: response.data.idToken,
        userData: {
          localId: response.data.localId,
          email: response.data.email,
          emailVerified: response.data.emailVerified || false,
          providerUserInfo: response.data.providerUserInfo || [],
          validSince: response.data.validSince || "",
          disabled: false,
          lastLoginAt: response.data.lastLoginAt || "",
          createdAt: response.data.createdAt || ""
        }
      };
    } catch (error: any) {
      if (error.response?.data?.error) {
        const firebaseError = error.response.data.error;
        
        switch (firebaseError.message) {
          case 'INVALID_PASSWORD':
            throw new Error("Current password is incorrect");
          case 'INVALID_ID_TOKEN':
            throw new Error("Invalid or expired token");
          case 'WEAK_PASSWORD':
            throw new Error("New password is too weak (minimum 6 characters)");
          case 'USER_NOT_FOUND':
            throw new Error("User not found");
          default:
            throw new Error(`Firebase error: ${firebaseError.message}`);
        }
      }
      
      throw new Error("Failed to update password");
    }
  }

  /**
   * Enviar email de verificação
   */
  static async sendEmailVerification(idToken: string): Promise<void> {
    try {
      const apiKey = process.env.FIREBASE_API_KEY;
      if (!apiKey) {
        throw new Error("FIREBASE_API_KEY is not defined in environment variables");
      }

      const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`;
      
      await axios.post(url, {
        requestType: "VERIFY_EMAIL",
        idToken: idToken
      });
    } catch (error: any) {
      if (error.response?.data?.error) {
        const firebaseError = error.response.data.error;
        throw new Error(`Firebase error: ${firebaseError.message}`);
      }
      
      throw new Error("Failed to send email verification");
    }
  }

  /**
   * Deletar conta do usuário
   */
  static async deleteAccount(idToken: string): Promise<void> {
    try {
      const apiKey = process.env.FIREBASE_API_KEY;
      if (!apiKey) {
        throw new Error("FIREBASE_API_KEY is not defined in environment variables");
      }

      const url = `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`;
      
      await axios.post(url, {
        idToken: idToken
      });
    } catch (error: any) {
      if (error.response?.data?.error) {
        const firebaseError = error.response.data.error;
        throw new Error(`Firebase error: ${firebaseError.message}`);
      }
      
      throw new Error("Failed to delete user account");
    }
  }
}