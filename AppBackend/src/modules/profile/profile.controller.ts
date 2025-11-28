
import { Router, Response } from "express";
import { ProfileService } from "./profile.service";
import { authMiddleware, AuthenticatedRequest } from "../../middleware/auth.middleware";
import express from "express";

const router = Router();

// Adicionar middleware para processar diferentes tipos de conteúdo
router.use(express.json());
router.use(express.text());
router.use(express.urlencoded({ extended: true }));

// Middleware customizado para processar text/plain como JSON
router.use((req, res, next) => {
  if (req.headers['content-type'] === 'text/plain; charset=utf-8' || 
      req.headers['content-type'] === 'text/plain') {
    try {
      if (typeof req.body === 'string') {
        req.body = JSON.parse(req.body);
      }
    } catch (error) {
      console.log('⚠️ Failed to parse text/plain as JSON:', error);
    }
  }
  next();
});


/**
 * GET /profile/drive-usage - Obter uso do Google Drive do usuário autenticado
 * Requer autenticação: Bearer token
 */
router.get("/drive-usage", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  console.log("🔔 [API] GET /profile/drive-usage called", req.headers.authorization);
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const usage = await ProfileService.getGoogleDriveUsage(userId);
    res.json(usage);
  } catch (error: any) {
    if (error.message === "Google Drive not connected") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Failed to get Google Drive usage" });
  }
});

/**
 * GET /profile - Buscar dados do perfil atual
 * Requer autenticação: Bearer token
 */
router.get("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Obter token do header
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ error: "Token not found" });
    }

    const profile = await ProfileService.getCurrentProfile(token);
    
    res.status(200).json({
      message: "Profile retrieved successfully",
      data: profile
    });
  } catch (error: any) {
    console.error("❌ Get profile error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /profile - Atualizar perfil completo
 * Body: { email?: string, password?: string, displayName?: string }
 * Requer autenticação: Bearer token
 */
router.put("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password} = req.body;

    // Validações básicas
    if (!email && !password) {
      return res.status(400).json({ 
        error: "At least one field (email, password, displayName) must be provided" 
      });
    }

    if (email && !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (password && password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    // Obter token do header
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ error: "Token not found" });
    }

    const updatedProfile = await ProfileService.updateProfile(token, {
      email,
      password,
    });

    res.status(200).json({
      message: "Profile updated successfully",
      data: updatedProfile
    });
  } catch (error: any) {
    console.error("❌ Update profile error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /profile/email - Atualizar apenas email
 * Body: { email: string }
 * Requer autenticação: Bearer token
 */
router.put("/email", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Obter token do header
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ error: "Token not found" });
    }

    const updatedProfile = await ProfileService.updateEmail(token, email);

    res.status(200).json({
      message: "Email updated successfully",
      data: updatedProfile
    });
  } catch (error: any) {
    console.error("❌ Update email error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /profile/password - Atualizar apenas password
 * Body: { currentPassword: string, newPassword: string }
 * Requer autenticação: Bearer token
 */
router.put("/password", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters long" });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ error: "New password must be different from current password" });
    }

    // Obter token do header
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ error: "Token not found" });
    }

    const result = await ProfileService.updatePassword(token, currentPassword, newPassword);

    res.status(200).json({
      message: "Password updated successfully",
      data: {
        passwordUpdated: true,
        newToken: result.idToken, // Novo token para manter autenticação
        user: result.userData
      }
    });
  } catch (error: any) {
    console.error("❌ Update password error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /profile/test - Endpoint de teste
 */
router.get("/test", (req: AuthenticatedRequest, res: Response) => {
  res.json({
    message: "Profile module is working!",
    availableEndpoints: [
      "GET /profile - Get current profile (requires auth)",
      "PUT /profile - Update profile (requires auth)",
      "PUT /profile/email - Update email only (requires auth)",
      "PUT /profile/password - Update password only (requires auth)",
      "GET /profile/test - Test endpoint"
    ],
    authRequired: "Bearer <firebase_token>"
  });
});

export default router;