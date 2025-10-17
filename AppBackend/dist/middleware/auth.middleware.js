"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const axios_1 = __importDefault(require("axios"));
const authMiddleware = async (req, res, next) => {
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
        const firebaseApiKey = process.env.FIREBASE_API_KEY;
        if (!firebaseApiKey) {
            throw new Error("Firebase API key not configured");
        }
        const response = await axios_1.default.post(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`, {
            idToken: token
        });
        if (!response.data.users || response.data.users.length === 0) {
            return res.status(401).json({ error: "Invalid token" });
        }
        const user = response.data.users[0];
        req.user = {
            uid: user.localId,
            email: user.email,
            email_verified: user.emailVerified || false
        };
        console.log(`✅ User authenticated: ${user.email} (${user.localId})`);
        next();
    }
    catch (error) {
        console.error("❌ Auth middleware error:", error.message);
        if (error.response?.status === 400) {
            return res.status(401).json({ error: "Invalid or expired token" });
        }
        return res.status(500).json({ error: "Authentication service error" });
    }
};
exports.authMiddleware = authMiddleware;
//# sourceMappingURL=auth.middleware.js.map