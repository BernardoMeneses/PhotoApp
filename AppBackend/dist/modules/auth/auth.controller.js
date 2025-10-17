"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_service_1 = require("./auth.service");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const google_drive_service_1 = require("../../services/google-drive.service");
const google_drive_token_service_1 = require("../../services/google-drive-token.service");
const router = (0, express_1.Router)();
router.post("/signup", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email e password são obrigatórios" });
        }
        const result = await auth_service_1.AuthService.signup(email, password);
        res.json(result);
    }
    catch (err) {
        console.error("❌ Signup error:", err.response?.data || err.message);
        res.status(400).json({ error: err.response?.data?.error?.message || err.message });
    }
});
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email e password são obrigatórios" });
        }
        const result = await auth_service_1.AuthService.login(email, password);
        res.json(result);
    }
    catch (err) {
        console.error("❌ Login error:", err.response?.data || err.message);
        res.status(401).json({ error: err.response?.data?.error?.message || err.message });
    }
});
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
        const result = await auth_service_1.AuthService.loginWithGoogle(idToken);
        console.log("✅ Google authentication successful");
        console.log("👤 User:", result.user.email);
        res.json({
            ...result,
            message: "Google authentication successful"
        });
    }
    catch (err) {
        console.error("❌ Google login error:", err.message);
        console.error("📋 Error stack:", err.stack);
        console.error("🔍 Error details:", err.response?.data || err);
        res.status(401).json({ error: err.message || "Google authentication failed" });
    }
});
router.post("/link-google", async (req, res) => {
    try {
        const { firebaseIdToken, googleIdToken } = req.body;
        if (!firebaseIdToken || !googleIdToken) {
            return res.status(400).json({
                error: "Firebase ID token and Google ID token are required"
            });
        }
        console.log("🔗 Linking Google account...");
        const result = await auth_service_1.AuthService.linkGoogleAccount(firebaseIdToken, googleIdToken);
        res.json(result);
    }
    catch (err) {
        console.error("❌ Link Google account error:", err.message);
        res.status(400).json({ error: err.message });
    }
});
router.post("/drive/login", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: "Authorization code is required in POST /auth/drive/login" });
        }
        const tokens = await google_drive_service_1.googleDriveService.exchangeCodeForTokens(code);
        await google_drive_token_service_1.GoogleDriveTokenService.saveTokens(req.user.uid, tokens);
        console.log("✅ Google Drive connected successfully");
        res.status(200).json({ message: "Google Drive connected successfully", connected: true });
    }
    catch (error) {
        console.error("❌ Google Drive login error:", error?.message || error);
        res.status(500).json({ error: "Failed to authenticate with Google Drive" });
    }
});
router.get("/drive/login", async (req, res) => {
    try {
        console.log("📥 Gerando URL de autenticação do Google Drive...");
        const authUrl = google_drive_service_1.googleDriveService.getAuthUrl();
        return res.status(200).json({ url: authUrl });
    }
    catch (error) {
        console.error("❌ Error generating Google Drive auth URL:", error?.message || error);
        res.status(500).json({ error: "Failed to generate auth URL" });
    }
});
router.get("/drive/status", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const hasTokens = await google_drive_token_service_1.GoogleDriveTokenService.hasTokens(req.user.uid);
        if (!hasTokens) {
            return res.status(200).json({
                connected: false,
                valid: false
            });
        }
        const tokens = await google_drive_token_service_1.GoogleDriveTokenService.loadTokens(req.user.uid);
        const isValid = tokens ? await google_drive_service_1.googleDriveService.validateTokens(tokens) : false;
        res.status(200).json({
            connected: true,
            valid: isValid
        });
    }
    catch (error) {
        console.error("❌ Error checking Google Drive status:", error.message);
        res.status(500).json({ error: "Failed to check Google Drive status" });
    }
});
router.get("/drive/callback", async (req, res) => {
    try {
        const code = req.query.code;
        if (!code) {
            return res.status(400).send("Missing authorization code");
        }
        console.log("📥 Código OAuth recebido:", code);
        const redirectUrl = `photoapp://drive-auth?code=${code}`;
        res.redirect(redirectUrl);
    }
    catch (error) {
        console.error("❌ Erro no callback do Google Drive:", error.message);
        res.status(500).send("Google Drive OAuth callback failed");
    }
});
router.post("/drive/disconnect", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        await google_drive_token_service_1.GoogleDriveTokenService.deleteTokens(req.user.uid);
        res.status(200).json({
            message: "Google Drive disconnected successfully",
            connected: false
        });
    }
    catch (error) {
        console.error("❌ Error disconnecting Google Drive:", error.message);
        res.status(500).json({ error: "Failed to disconnect Google Drive" });
    }
});
exports.default = router;
//# sourceMappingURL=auth.controller.js.map