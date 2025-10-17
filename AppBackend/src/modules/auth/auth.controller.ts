import { Router, Request, Response } from "express";
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
// POST handles exchange (expects code in body)
router.post("/drive/login", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Authorization code is required in POST /auth/drive/login" });
    }

    // Exchange code for tokens and save
    const tokens = await googleDriveService.exchangeCodeForTokens(code);
    await GoogleDriveTokenService.saveTokens(req.user.uid, tokens);

    console.log("✅ Google Drive connected successfully");

    res.status(200).json({ message: "Google Drive connected successfully", connected: true });
  } catch (error: any) {
    console.error("❌ Google Drive login error:", error?.message || error);
    res.status(500).json({ error: "Failed to authenticate with Google Drive" });
  }
});

// GET returns the auth URL so the mobile/web client can redirect the user
router.get("/drive/login", async (req: Request, res: Response) => {
  try {
    console.log("📥 Gerando URL de autenticação do Google Drive...");
    
    const authUrl = googleDriveService.getAuthUrl();
    return res.status(200).json({ url: authUrl });
  } catch (error: any) {
    console.error("❌ Error generating Google Drive auth URL:", error?.message || error);
    res.status(500).json({ error: "Failed to generate auth URL" });
  }
});

/**
 * GET /auth/drive/status - Verificar estado da conexão Google Drive
 */
router.get("/drive/status", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const hasTokens = await GoogleDriveTokenService.hasTokens(req.user.uid);
    
    if (!hasTokens) {
      return res.status(200).json({ 
        connected: false, 
        valid: false 
      });
    }

    const tokens = await GoogleDriveTokenService.loadTokens(req.user.uid);
    const isValid = tokens ? await googleDriveService.validateTokens(tokens) : false;
    
    res.status(200).json({ 
      connected: true, 
      valid: isValid 
    });
  } catch (error: any) {
    console.error("❌ Error checking Google Drive status:", error.message);
    res.status(500).json({ error: "Failed to check Google Drive status" });
  }
});
/**
 * GET /auth/drive/callback - Callback da autenticação Google OAuth
 * Este endpoint é chamado diretamente pelo Google após o consentimento
 */
router.get("/drive/callback", async (req, res) => {
  try {
    const code = req.query.code as string;

    if (!code) {
      return res.status(400).send("Missing authorization code");
    }

    console.log("📥 Código OAuth recebido:", code);

    // Apenas redirecionar de volta ao frontend com o code na URL
    // O Flutter pode extrair este code e chamar /auth/drive/login novamente com ele
    const redirectUrl = `photoapp://drive-auth?code=${code}`;
    res.redirect(redirectUrl);

  } catch (error: any) {
    console.error("❌ Erro no callback do Google Drive:", error.message);
    res.status(500).send("Google Drive OAuth callback failed");
  }
});

/**
 * POST /auth/drive/disconnect - Desconectar Google Drive
 */
router.post("/drive/disconnect", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

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

export default router;


