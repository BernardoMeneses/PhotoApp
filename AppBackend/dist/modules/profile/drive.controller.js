"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const google_drive_service_1 = require("../../services/google-drive.service");
const database_1 = require("../../config/database");
const router = (0, express_1.Router)();
router.get("/usage", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const result = await database_1.pool.query("SELECT google_drive_access_token, google_drive_refresh_token FROM users WHERE id = $1", [userId]);
        const row = result.rows[0];
        if (!row || !row.google_drive_access_token) {
            return res.status(400).json({ error: "Google Drive not connected" });
        }
        const tokens = {
            access_token: row.google_drive_access_token,
            refresh_token: row.google_drive_refresh_token,
        };
        const drive = google_drive_service_1.googleDriveService["createDriveClient"](tokens);
        const about = await drive.about.get({ fields: "storageQuota" });
        const quota = about.data.storageQuota;
        res.json({
            used: Number(quota?.usage || 0),
            total: Number(quota?.limit || 15 * 1024 * 1024 * 1024)
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message || "Failed to get Google Drive usage" });
    }
});
exports.default = router;
//# sourceMappingURL=drive.controller.js.map