import { Request, Response, NextFunction } from "express";
import axios from "axios";

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email: string;
    email_verified: boolean;
  };
  body: any; // Permite destructuring do body
}

/**
 * Erro personalizado para token expirado
 * O frontend deve usar este código para saber quando fazer refresh
 */
const TOKEN_EXPIRED_CODE = "TOKEN_EXPIRED";
const INVALID_TOKEN_CODE = "INVALID_TOKEN";

/**
 * Middleware de autenticação Firebase
 * Verifica o token JWT no header Authorization
 * 
 * Quando o token expira, retorna:
 * - status 401
 * - error: "TOKEN_EXPIRED"
 * - message: "Token expired. Please refresh your token."
 * 
 * O frontend deve chamar POST /auth/refresh com o refreshToken para obter um novo idToken
 */
export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        error: INVALID_TOKEN_CODE,
        message: "Authorization token required. Format: Bearer <token>" 
      });
    }

    const token = authHeader.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ 
        error: INVALID_TOKEN_CODE, 
        message: "Token not provided" 
      });
    }

    // Verificar token com Firebase
    const firebaseApiKey = process.env.FIREBASE_API_KEY;
    if (!firebaseApiKey) {
      throw new Error("Firebase API key not configured");
    }

    const response = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
      {
        idToken: token
      }
    );

    if (!response.data.users || response.data.users.length === 0) {
      return res.status(401).json({ 
        error: INVALID_TOKEN_CODE, 
        message: "Invalid token" 
      });
    }

    const user = response.data.users[0];
    
    // Adicionar dados do usuário ao request
    req.user = {
      uid: user.localId,
      email: user.email,
      email_verified: user.emailVerified || false
    };

    console.log(`✅ User authenticated: ${user.email} (${user.localId})`);
    next();
    
  } catch (error: any) {
    console.error("❌ Auth middleware error:", error.message);
    
    // Verificar se o erro é token expirado ou inválido
    if (error.response?.status === 400) {
      const firebaseError = error.response?.data?.error;
      const errorMessage = firebaseError?.message || "";
      
      // Firebase retorna "INVALID_ID_TOKEN" ou "TOKEN_EXPIRED" quando o token expira
      if (errorMessage.includes("TOKEN_EXPIRED") || errorMessage.includes("INVALID_ID_TOKEN")) {
        console.log("⚠️ Token expired, client should refresh");
        return res.status(401).json({ 
          error: TOKEN_EXPIRED_CODE, 
          message: "Token expired. Please refresh your token using POST /auth/refresh with your refreshToken." 
        });
      }
      
      return res.status(401).json({ 
        error: INVALID_TOKEN_CODE, 
        message: "Invalid or expired token" 
      });
    }
    
    return res.status(500).json({ 
      error: "AUTH_SERVICE_ERROR", 
      message: "Authentication service error" 
    });
  }
};