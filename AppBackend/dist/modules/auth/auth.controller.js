"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_service_1 = require("./auth.service");
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
exports.default = router;
//# sourceMappingURL=auth.controller.js.map