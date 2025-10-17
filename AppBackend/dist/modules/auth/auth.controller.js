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
            const authUrl = google_drive_service_1.googleDriveService.getAuthUrl();
            return res.status(200).json({
                message: "Google Drive authentication URL generated",
                authUrl: authUrl,
                step: "auth_url"
            });
        }
        console.log("🔐 Processing Google Drive login with code...");
        const tokens = await google_drive_service_1.googleDriveService.exchangeCodeForTokens(code);
        await google_drive_token_service_1.GoogleDriveTokenService.saveTokens(req.user.uid, tokens);
        const isValid = await google_drive_service_1.googleDriveService.validateTokens(tokens);
        let photosCount = 0;
        try {
            const photos = await google_drive_service_1.googleDriveService.listPhotos(tokens);
            photosCount = photos.length;
        }
        catch (photoError) {
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
    }
    catch (error) {
        console.error("❌ Error in Google Drive login:", error.message);
        res.status(500).json({ error: "Failed to connect Google Drive: " + error.message });
    }
});
router.get("/drive/status", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const hasTokens = await google_drive_token_service_1.GoogleDriveTokenService.hasTokens(req.user.uid);
        if (hasTokens) {
            const tokens = await google_drive_token_service_1.GoogleDriveTokenService.loadTokens(req.user.uid);
            const isValid = tokens ? await google_drive_service_1.googleDriveService.validateTokens(tokens) : false;
            let photosCount = 0;
            if (isValid && tokens) {
                try {
                    const photos = await google_drive_service_1.googleDriveService.listPhotos(tokens);
                    photosCount = photos.length;
                }
                catch (error) {
                    console.warn("⚠️ Could not count photos:", error);
                }
            }
            res.status(200).json({
                connected: true,
                valid: isValid,
                photosCount: photosCount
            });
        }
        else {
            res.status(200).json({
                connected: false,
                valid: false,
                photosCount: 0
            });
        }
    }
    catch (error) {
        console.error("❌ Error checking Google Drive status:", error.message);
        res.status(500).json({ error: "Failed to check Google Drive status" });
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
router.get("/drive/photos", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const tokens = await google_drive_token_service_1.GoogleDriveTokenService.loadTokens(req.user.uid);
        if (!tokens) {
            return res.status(400).json({ error: "Google Drive not connected" });
        }
        const photos = await google_drive_service_1.googleDriveService.listPhotos(tokens);
        res.status(200).json({
            message: "Google Drive photos retrieved successfully",
            photos: photos
        });
    }
    catch (error) {
        console.error("❌ Error listing Google Drive photos:", error.message);
        res.status(500).json({ error: "Failed to list Google Drive photos" });
    }
});
router.post("/drive/photos/delete", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const { fileId } = req.body;
        if (!fileId) {
            return res.status(400).json({ error: "File ID is required" });
        }
        const tokens = await google_drive_token_service_1.GoogleDriveTokenService.loadTokens(req.user.uid);
        if (!tokens) {
            return res.status(400).json({ error: "Google Drive not connected" });
        }
        const deleted = await google_drive_service_1.googleDriveService.deletePhoto(tokens, fileId);
        if (deleted) {
            res.status(200).json({ message: "Photo deleted from Google Drive successfully" });
        }
        else {
            res.status(404).json({ error: "Photo not found or failed to delete" });
        }
    }
    catch (error) {
        console.error("❌ Error deleting Google Drive photo:", error.message);
        res.status(500).json({ error: "Failed to delete Google Drive photo" });
    }
});
router.post("/drive/photos/batch-delete", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const { fileIds } = req.body;
        if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
            return res.status(400).json({ error: "File IDs array is required and must not be empty" });
        }
        const tokens = await google_drive_token_service_1.GoogleDriveTokenService.loadTokens(req.user.uid);
        if (!tokens) {
            return res.status(400).json({ error: "Google Drive not connected" });
        }
        const results = await google_drive_service_1.googleDriveService.batchDeletePhotos(tokens, fileIds);
        res.status(200).json({
            message: `Batch delete completed. Success: ${results.success.length}, Failed: ${results.failed.length}`,
            success: results.success,
            failed: results.failed
        });
    }
    catch (error) {
        console.error("❌ Error batch deleting Google Drive photos:", error.message);
        res.status(500).json({ error: "Failed to batch delete Google Drive photos" });
    }
});
exports.default = router;
//# sourceMappingURL=auth.controller.js.map