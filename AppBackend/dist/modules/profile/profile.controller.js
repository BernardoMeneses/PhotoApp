"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const profile_service_1 = require("./profile.service");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const express_2 = __importDefault(require("express"));
const router = (0, express_1.Router)();
router.use(express_2.default.json());
router.use(express_2.default.text());
router.use(express_2.default.urlencoded({ extended: true }));
router.use((req, res, next) => {
    if (req.headers['content-type'] === 'text/plain; charset=utf-8' ||
        req.headers['content-type'] === 'text/plain') {
        try {
            if (typeof req.body === 'string') {
                req.body = JSON.parse(req.body);
            }
        }
        catch (error) {
            console.log('⚠️ Failed to parse text/plain as JSON:', error);
        }
    }
    next();
});
router.get("/drive-usage", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const usage = await profile_service_1.ProfileService.getGoogleDriveUsage(userId);
        res.json(usage);
    }
    catch (error) {
        if (error.message === "Google Drive not connected") {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message || "Failed to get Google Drive usage" });
    }
});
router.get("/", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(" ")[1];
        if (!token) {
            return res.status(401).json({ error: "Token not found" });
        }
        const profile = await profile_service_1.ProfileService.getCurrentProfile(token);
        res.status(200).json({
            message: "Profile retrieved successfully",
            data: profile
        });
    }
    catch (error) {
        console.error("❌ Get profile error:", error.message);
        res.status(500).json({ error: error.message });
    }
});
router.put("/", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { email, password } = req.body;
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
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(" ")[1];
        if (!token) {
            return res.status(401).json({ error: "Token not found" });
        }
        const updatedProfile = await profile_service_1.ProfileService.updateProfile(token, {
            email,
            password,
        });
        res.status(200).json({
            message: "Profile updated successfully",
            data: updatedProfile
        });
    }
    catch (error) {
        console.error("❌ Update profile error:", error.message);
        res.status(500).json({ error: error.message });
    }
});
router.put("/email", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }
        if (!/\S+@\S+\.\S+/.test(email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(" ")[1];
        if (!token) {
            return res.status(401).json({ error: "Token not found" });
        }
        const updatedProfile = await profile_service_1.ProfileService.updateEmail(token, email);
        res.status(200).json({
            message: "Email updated successfully",
            data: updatedProfile
        });
    }
    catch (error) {
        console.error("❌ Update email error:", error.message);
        res.status(500).json({ error: error.message });
    }
});
router.put("/password", auth_middleware_1.authMiddleware, async (req, res) => {
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
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(" ")[1];
        if (!token) {
            return res.status(401).json({ error: "Token not found" });
        }
        const result = await profile_service_1.ProfileService.updatePassword(token, currentPassword, newPassword);
        res.status(200).json({
            message: "Password updated successfully",
            data: {
                passwordUpdated: true,
                newToken: result.idToken,
                user: result.userData
            }
        });
    }
    catch (error) {
        console.error("❌ Update password error:", error.message);
        res.status(500).json({ error: error.message });
    }
});
router.get("/test", (req, res) => {
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
exports.default = router;
//# sourceMappingURL=profile.controller.js.map