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
 * Middleware de autenticação Firebase
 * Verifica o token JWT no header Authorization
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
        error: "Authorization token required. Format: Bearer <token>" 
      });
    }

    const token = authHeader.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ error: "Token not provided" });
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
      return res.status(401).json({ error: "Invalid token" });
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
    
    if (error.response?.status === 400) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    
    return res.status(500).json({ error: "Authentication service error" });
  }
};