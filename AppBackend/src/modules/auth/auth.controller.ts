import { Router } from "express";
import { AuthService } from "./auth.service";
import { authMiddleware, AuthenticatedRequest } from "../../middleware/auth.middleware";
import { googleDriveService } from "../../services/google-drive.service";
import { GoogleDriveTokenService } from "../../services/google-drive-token.service";

const router = Router();

/**
 * Registo de utilizador
 */
router.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email e password são obrigatórios" });
    }

    const result = await AuthService.signup(email, password);
    res.json(result);
  } catch (err: any) {
    console.error("❌ Signup error:", err.response?.data || err.message);
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

/**
 * Login de utilizador
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email e password são obrigatórios" });
    }

    const result = await AuthService.login(email, password);
    res.json(result);
  } catch (err: any) {
    console.error("❌ Login error:", err.response?.data || err.message);
    res.status(401).json({ error: err.response?.data?.error?.message || err.message });
  }
});

/**
 * Login com Google
 * Recebe o Google ID token do frontend e autentica no Firebase
 */
router.post("/google/callback", async (req, res) => {
  try {
    console.log("📥 Received Google login request");
    console.log("📦 Request body:", JSON.stringify(req.body, null, 2));
    
    const { idToken } = req.body;
    
    if (!idToken) {
      console.error("❌ Missing idToken in request body");
      return res.status(400).json({ error: "Google ID token is required" });
    }

    console.log("🔐 Authenticating with Google...");
    console.log("🎫 Token preview:", idToken.substring(0, 50) + "...");
    
    const result = await AuthService.loginWithGoogle(idToken);
    
    console.log("✅ Google authentication successful");
    console.log("👤 User:", result.user.email);
    
    res.json({
      ...result,
      message: "Google authentication successful"
    });
  } catch (err: any) {
    console.error("❌ Google login error:", err.message);
    console.error("📋 Error stack:", err.stack);
    console.error("🔍 Error details:", err.response?.data || err);
    res.status(401).json({ error: err.message || "Google authentication failed" });
  }
});

/**
 * Vincular conta Google a uma conta existente
 * Permite que um usuário que já tem email/senha também possa fazer login com Google
 */
router.post("/link-google", async (req, res) => {
  try {
    const { firebaseIdToken, googleIdToken } = req.body;
    
    if (!firebaseIdToken || !googleIdToken) {
      return res.status(400).json({ 
        error: "Firebase ID token and Google ID token are required" 
      });
    }

    console.log("🔗 Linking Google account...");
    const result = await AuthService.linkGoogleAccount(firebaseIdToken, googleIdToken);
    
    res.json(result);
  } catch (err: any) {
    console.error("❌ Link Google account error:", err.message);
    res.status(400).json({ error: err.message });
  }
});

// ========== GOOGLE DRIVE ENDPOINT ==========

/**
 * POST /auth/drive/login - Login completo ao Google Drive
 * Recebe o código de autorização e conecta automaticamente
 */
router.post("/drive/login", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { code } = req.body;
    
    // Se não tem código, gerar URL de autenticação
    if (!code) {
      const authUrl = googleDriveService.getAuthUrl();
      return res.status(200).json({
        message: "Google Drive authentication URL generated",
        authUrl: authUrl,
        step: "auth_url"
      });
    }

    // Se tem código, processar login completo
    console.log("🔐 Processing Google Drive login with code...");
    
    // 1. Trocar código por tokens
    const tokens = await googleDriveService.exchangeCodeForTokens(code);
    
    // 2. Salvar tokens no banco de dados
    await GoogleDriveTokenService.saveTokens(req.user.uid, tokens);
    
    // 3. Validar tokens
    const isValid = await googleDriveService.validateTokens(tokens);
    
    // 4. Listar fotos como teste de conexão
    let photosCount = 0;
    try {
      const photos = await googleDriveService.listPhotos(tokens);
      photosCount = photos.length;
    } catch (photoError) {
      console.warn("⚠️ Could not list photos after connection:", photoError);
    }
    
    console.log("✅ Google Drive connected successfully");
    
    res.status(200).json({
      message: "Google Drive connected and ready",
      connected: true,
      valid: isValid,
      photosFound: photosCount,
      step: "completed"
    });
  } catch (error: any) {
    console.error("❌ Error in Google Drive login:", error.message);
    res.status(500).json({ error: "Failed to connect Google Drive: " + error.message });
  }
});

/**
 * GET /auth/drive/status - Verificar status da conexão com Google Drive
 */
router.get("/drive/status", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const hasTokens = await GoogleDriveTokenService.hasTokens(req.user.uid);
    
    if (hasTokens) {
      const tokens = await GoogleDriveTokenService.loadTokens(req.user.uid);
      const isValid = tokens ? await googleDriveService.validateTokens(tokens) : false;
      
      // Se conectado, também contar fotos
      let photosCount = 0;
      if (isValid && tokens) {
        try {
          const photos = await googleDriveService.listPhotos(tokens);
          photosCount = photos.length;
        } catch (error) {
          console.warn("⚠️ Could not count photos:", error);
        }
      }
      
      res.status(200).json({
        connected: true,
        valid: isValid,
        photosCount: photosCount
      });
    } else {
      res.status(200).json({
        connected: false,
        valid: false,
        photosCount: 0
      });
    }
  } catch (error: any) {
    console.error("❌ Error checking Google Drive status:", error.message);
    res.status(500).json({ error: "Failed to check Google Drive status" });
  }
});

/**
 * POST /auth/drive/disconnect - Desconectar Google Drive
 * Remove tokens do banco de dados
 */
router.post("/drive/disconnect", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Remover tokens do banco de dados
    await GoogleDriveTokenService.deleteTokens(req.user.uid);
    
    res.status(200).json({
      message: "Google Drive disconnected successfully",
      connected: false
    });
  } catch (error: any) {
    console.error("❌ Error disconnecting Google Drive:", error.message);
    res.status(500).json({ error: "Failed to disconnect Google Drive" });
  }
});

/**
 * GET /auth/drive/photos - Listar fotos do Google Drive
 */
router.get("/drive/photos", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Verificar se tem tokens salvos
    const tokens = await GoogleDriveTokenService.loadTokens(req.user.uid);
    if (!tokens) {
      return res.status(400).json({ error: "Google Drive not connected" });
    }

    // Listar fotos do Google Drive
    const photos = await googleDriveService.listPhotos(tokens);
    
    res.status(200).json({
      message: "Google Drive photos retrieved successfully",
      photos: photos
    });
  } catch (error: any) {
    console.error("❌ Error listing Google Drive photos:", error.message);
    res.status(500).json({ error: "Failed to list Google Drive photos" });
  }
});

/**
 * POST /auth/drive/photos/delete - Deletar foto do Google Drive
 */
router.post("/drive/photos/delete", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { fileId } = req.body;
    
    if (!fileId) {
      return res.status(400).json({ error: "File ID is required" });
    }

    // Verificar se tem tokens salvos
    const tokens = await GoogleDriveTokenService.loadTokens(req.user.uid);
    if (!tokens) {
      return res.status(400).json({ error: "Google Drive not connected" });
    }

    // Deletar foto do Google Drive
    const deleted = await googleDriveService.deletePhoto(tokens, fileId);
    
    if (deleted) {
      res.status(200).json({ message: "Photo deleted from Google Drive successfully" });
    } else {
      res.status(404).json({ error: "Photo not found or failed to delete" });
    }
  } catch (error: any) {
    console.error("❌ Error deleting Google Drive photo:", error.message);
    res.status(500).json({ error: "Failed to delete Google Drive photo" });
  }
});

/**
 * POST /auth/drive/photos/batch-delete - Deletar múltiplas fotos do Google Drive
 */
router.post("/drive/photos/batch-delete", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { fileIds } = req.body;
    
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ error: "File IDs array is required and must not be empty" });
    }

    // Verificar se tem tokens salvos
    const tokens = await GoogleDriveTokenService.loadTokens(req.user.uid);
    if (!tokens) {
      return res.status(400).json({ error: "Google Drive not connected" });
    }

    // Deletar fotos em lote do Google Drive
    const results = await googleDriveService.batchDeletePhotos(tokens, fileIds);
    
    res.status(200).json({
      message: `Batch delete completed. Success: ${results.success.length}, Failed: ${results.failed.length}`,
      success: results.success,
      failed: results.failed
    });
  } catch (error: any) {
    console.error("❌ Error batch deleting Google Drive photos:", error.message);
    res.status(500).json({ error: "Failed to batch delete Google Drive photos" });
  }
});


export default router;


