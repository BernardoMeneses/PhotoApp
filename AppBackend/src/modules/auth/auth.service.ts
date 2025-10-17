import jwt from "jsonwebtoken";
import axios from "axios";

interface FirebaseAuthResponse {
  localId: string;
  email: string;
  idToken: string;
  refreshToken: string;
  expiresIn: string;
}

interface AuthResult {
  user: {
    id: string;
    email: string;
  };
  token: string;
  idToken: string; // ✅ Adicionar idToken do Firebase
}

export class AuthService {
  /**
   * Gera o nosso próprio JWT
   */
  static generateToken(userId: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET is not defined in environment variables");
    }
    
    const expiresIn = process.env.JWT_EXPIRES_IN || "1d";
    return jwt.sign({ id: userId }, secret, { expiresIn } as any);
  }

  static verifyToken(token: string): jwt.JwtPayload | string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET is not defined in environment variables");
    }
    
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      throw new Error("Invalid or expired token");
    }
  }

  /**
   * Cria utilizador no Firebase via REST API
   */
  static async signup(email: string, password: string): Promise<AuthResult> {
    try {
      const apiKey = process.env.FIREBASE_API_KEY;
      if (!apiKey) {
        throw new Error("FIREBASE_API_KEY is not defined in environment variables");
      }

      const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
      
      const response = await axios.post<FirebaseAuthResponse>(url, {
        email,
        password,
        returnSecureToken: true
      });

      const { localId, email: userEmail, idToken } = response.data;
      const token = this.generateToken(localId);

      return {
        user: { id: localId, email: userEmail },
        token,
        idToken // ✅ Retorna o idToken nativo do Firebase
      };
    } catch (error: any) {
      // Tratar erros específicos do Firebase
      if (error.response?.data?.error) {
        const firebaseError = error.response.data.error;
        
        switch (firebaseError.message) {
          case 'EMAIL_EXISTS':
            throw new Error("Email already exists");
          case 'WEAK_PASSWORD':
            throw new Error("Password is too weak");
          case 'INVALID_EMAIL':
            throw new Error("Invalid email format");
          default:
            throw new Error(`Firebase error: ${firebaseError.message}`);
        }
      }
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error("Unable to connect to Firebase. Check your internet connection.");
      }
      
      throw new Error("Failed to create user account");
    }
  }

  /**
   * Login com Firebase via REST API
   */
  static async login(email: string, password: string): Promise<AuthResult> {
    try {
      const apiKey = process.env.FIREBASE_API_KEY;
      if (!apiKey) {
        throw new Error("FIREBASE_API_KEY is not defined in environment variables");
      }

      const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
      
      const response = await axios.post<FirebaseAuthResponse>(url, {
        email,
        password,
        returnSecureToken: true
      });

      const { localId, email: userEmail, idToken } = response.data;
      const token = this.generateToken(localId);

      return {
        user: { id: localId, email: userEmail },
        token,
        idToken // ✅ Retorna o idToken nativo do Firebase
      };
    } catch (error: any) {
      // Tratar erros específicos do Firebase
      if (error.response?.data?.error) {
        const firebaseError = error.response.data.error;
        
        switch (firebaseError.message) {
          case 'EMAIL_NOT_FOUND':
            throw new Error("No user found with this email");
          case 'INVALID_PASSWORD':
            throw new Error("Invalid password");
          case 'USER_DISABLED':
            throw new Error("User account has been disabled");
          case 'INVALID_EMAIL':
            throw new Error("Invalid email format");
          default:
            throw new Error(`Firebase error: ${firebaseError.message}`);
        }
      }
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error("Unable to connect to Firebase. Check your internet connection.");
      }
      
      throw new Error("Failed to authenticate user");
    }
  }

  /**
   * Autenticar com Google usando o idToken do Google
   * Este método verifica o token do Google e cria/autentica o usuário no Firebase
   */
  static async loginWithGoogle(googleIdToken: string): Promise<AuthResult> {
    try {
      console.log('🔵 Starting Google authentication...');
      
      const apiKey = process.env.FIREBASE_API_KEY;
      if (!apiKey) {
        console.error('❌ FIREBASE_API_KEY not found in environment');
        throw new Error("FIREBASE_API_KEY is not defined in environment variables");
      }

      console.log('✅ Firebase API Key found');
      console.log('🔵 Token length:', googleIdToken.length);

      // Verificar e trocar o Google ID token por um Firebase ID token
      // Firebase Authentication REST API: signInWithIdp
      const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${apiKey}`;
      
      const requestBody = {
        postBody: `id_token=${googleIdToken}&providerId=google.com`,
        requestUri: process.env.FIREBASE_AUTH_DOMAIN || 'http://localhost:3000',
        returnSecureToken: true,
        returnIdpCredential: true
      };
      
      console.log('🔵 Making request to Firebase with requestUri:', requestBody.requestUri);
      
      const response = await axios.post<FirebaseAuthResponse>(url, requestBody);

      console.log('✅ Firebase response received');
      console.log('📦 Response data keys:', Object.keys(response.data));

      const { localId, email, idToken } = response.data;
      
      if (!email) {
        console.error('❌ No email in Firebase response');
        throw new Error("Google account does not have an email address");
      }

      // Gerar nosso próprio JWT
      const token = this.generateToken(localId);

      console.log('✅ Google authentication successful for:', email);
      console.log('👤 User ID:', localId);

      return {
        user: { id: localId, email },
        token,
        idToken // Firebase idToken
      };
    } catch (error: any) {
      console.error('❌ Google authentication error');
      console.error('📋 Error message:', error.message);
      console.error('📋 Error code:', error.code);
      
      if (error.response) {
        console.error('📋 Response status:', error.response.status);
        console.error('📋 Response data:', JSON.stringify(error.response.data, null, 2));
      }
      
      // Tratar erros específicos do Firebase
      if (error.response?.data?.error) {
        const firebaseError = error.response.data.error;
        console.error('🔥 Firebase error message:', firebaseError.message);
        
        switch (firebaseError.message) {
          case 'INVALID_IDP_RESPONSE':
            throw new Error("Invalid Google token - the token may have expired or is malformed");
          case 'USER_DISABLED':
            throw new Error("User account has been disabled");
          case 'FEDERATED_USER_ID_ALREADY_LINKED':
            throw new Error("This Google account is already linked to another user");
          default:
            throw new Error(`Firebase error: ${firebaseError.message}`);
        }
      }
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error("Unable to connect to Firebase. Check your internet connection.");
      }
      
      throw new Error(`Failed to authenticate with Google: ${error.message}`);
    }
  }

  /**
   * Vincular conta Google a uma conta existente (link providers)
   * Permite que um usuário com email/senha também possa fazer login com Google
   */
  static async linkGoogleAccount(firebaseIdToken: string, googleIdToken: string): Promise<{ message: string }> {
    try {
      const apiKey = process.env.FIREBASE_API_KEY;
      if (!apiKey) {
        throw new Error("FIREBASE_API_KEY is not defined in environment variables");
      }

      // Usar a API do Firebase para vincular o provedor Google
      const url = `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`;
      
      await axios.post(url, {
        idToken: firebaseIdToken,
        linkIdToken: googleIdToken,
        returnSecureToken: true
      });

      console.log('✅ Google account linked successfully');

      return {
        message: "Google account linked successfully. You can now login with Google."
      };
    } catch (error: any) {
      console.error('❌ Link Google account error:', error.response?.data || error.message);
      
      if (error.response?.data?.error) {
        const firebaseError = error.response.data.error;
        
        switch (firebaseError.message) {
          case 'CREDENTIAL_TOO_OLD_LOGIN_AGAIN':
            throw new Error("Please login again to link Google account");
          case 'TOKEN_EXPIRED':
            throw new Error("Session expired. Please login again");
          case 'FEDERATED_USER_ID_ALREADY_LINKED':
            throw new Error("This Google account is already linked to another user");
          default:
            throw new Error(`Firebase error: ${firebaseError.message}`);
        }
      }
      
      throw new Error("Failed to link Google account");
    }
  }
}
