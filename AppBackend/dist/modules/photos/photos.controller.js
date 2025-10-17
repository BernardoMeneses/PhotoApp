"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const photos_service_1 = require("./photos.service");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const google_drive_service_1 = require("../../services/google-drive.service");
const google_drive_token_service_1 = require("../../services/google-drive-token.service");
const router = (0, express_1.Router)();
const photosService = new photos_service_1.PhotosService();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 100
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});
router.post("/upload", auth_middleware_1.authMiddleware, upload.array('photos', 10), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: "No files uploaded" });
        }
        console.log(`📤 Uploading ${files.length} photo(s) for user: ${req.user.uid}`);
        const uploadedPhotos = await photosService.uploadPhotosWithUser(files, req.user.uid);
        console.log(`✅ Successfully uploaded ${uploadedPhotos.length} photo(s)`);
        res.status(200).json({
            message: `Successfully uploaded ${uploadedPhotos.length} photo(s)`,
            photos: uploadedPhotos
        });
    }
    catch (error) {
        console.error("❌ Upload error:", error.message);
        res.status(500).json({ error: "Failed to upload photos: " + error.message });
    }
});
router.get("/", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const photos = await photosService.listUserPhotos(req.user.uid);
        res.status(200).json(photos);
    }
    catch (error) {
        console.error("Error listing photos:", error.message);
        res.status(500).json({ error: "Failed to list photos" });
    }
});
router.get("/all", async (req, res) => {
    try {
        const photos = await photosService.listAllPhotos();
        res.status(200).json(photos);
    }
    catch (error) {
        console.error("Error listing all photos:", error.message);
        res.status(500).json({ error: "Failed to list photos" });
    }
});
router.post("/delete/:photoName", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const { photoName } = req.params;
        const success = await photosService.deleteUserPhoto(photoName, req.user.uid);
        if (success) {
            res.status(200).json({ message: "Photo deleted successfully" });
        }
        else {
            res.status(404).json({ error: "Photo not found" });
        }
    }
    catch (error) {
        console.error("Delete photo error:", error.message);
        res.status(500).json({ error: "Failed to delete photo" });
    }
});
router.post("/delete-by-url", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const photoUrl = req.body?.photoUrl;
        if (!photoUrl) {
            return res.status(400).json({ error: "photoUrl is required" });
        }
        const success = await photosService.deletePhotoByUrl(photoUrl, req.user.uid);
        if (success) {
            res.status(200).json({ message: "Photo deleted successfully" });
        }
        else {
            res.status(404).json({ error: "Photo not found" });
        }
    }
    catch (error) {
        console.error("Delete photo by URL error:", error.message);
        res.status(500).json({ error: "Failed to delete photo" });
    }
});
router.get("/library", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const grouped = await photosService.listLibraryPhotos(req.user.uid);
        res.json({ message: "Library photos grouped by year", data: grouped });
    }
    catch (e) {
        console.error("❌ Library photos error:", e.message);
        res.status(500).json({ error: e.message });
    }
});
router.post("/batch-delete", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        console.log("📥 Body recebido:", req.body);
        console.log("📥 Body type:", typeof req.body);
        console.log("📥 Body keys:", Object.keys(req.body || {}));
        const photoNames = req.body?.photoNames;
        console.log("📥 photoNames extraído:", photoNames);
        console.log("📥 photoNames type:", typeof photoNames);
        console.log("📥 photoNames isArray:", Array.isArray(photoNames));
        if (!photoNames || !Array.isArray(photoNames) || photoNames.length === 0) {
            return res.status(400).json({ error: "photoNames array is required and must not be empty" });
        }
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        console.log(`🗑️ Batch deleting ${photoNames.length} photos for user ${req.user.uid}`);
        const results = await photosService.batchDeletePhotos(photoNames, req.user.uid);
        res.status(200).json({
            message: `Batch delete completed. Success: ${results.success.length}, Failed: ${results.failed.length}`,
            success: results.success,
            failed: results.failed
        });
    }
    catch (err) {
        console.error("❌ Erro ao eliminar múltiplas fotos:", err.message);
        res.status(500).json({ error: err.message });
    }
});
router.post("/connect-drive", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const authUrl = google_drive_service_1.googleDriveService.getAuthUrl();
        res.status(200).json({
            message: "Google Drive authentication URL generated",
            authUrl: authUrl
        });
    }
    catch (error) {
        console.error("❌ Error generating Google Drive auth URL:", error.message);
        res.status(500).json({ error: "Failed to generate auth URL" });
    }
});
router.post("/drive-callback", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: "Authorization code is required" });
        }
        const tokens = await google_drive_service_1.googleDriveService.exchangeCodeForTokens(code);
        await google_drive_token_service_1.GoogleDriveTokenService.saveTokens(req.user.uid, tokens);
        res.status(200).json({
            message: "Google Drive connected successfully",
            connected: true
        });
    }
    catch (error) {
        console.error("❌ Error connecting Google Drive:", error.message);
        res.status(500).json({ error: "Failed to connect Google Drive: " + error.message });
    }
});
router.get("/drive-status", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const hasTokens = await google_drive_token_service_1.GoogleDriveTokenService.hasTokens(req.user.uid);
        if (hasTokens) {
            const tokens = await google_drive_token_service_1.GoogleDriveTokenService.loadTokens(req.user.uid);
            const isValid = tokens ? await google_drive_service_1.googleDriveService.validateTokens(tokens) : false;
            res.status(200).json({
                connected: true,
                valid: isValid
            });
        }
        else {
            res.status(200).json({
                connected: false,
                valid: false
            });
        }
    }
    catch (error) {
        console.error("❌ Error checking Google Drive status:", error.message);
        res.status(500).json({ error: "Failed to check Google Drive status" });
    }
});
router.post("/disconnect-drive", auth_middleware_1.authMiddleware, async (req, res) => {
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
router.get("/image/:fileId", async (req, res) => {
    try {
        const { fileId } = req.params;
        const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000-h1000`;
        res.redirect(thumbnailUrl);
    }
    catch (error) {
        console.error("❌ Error serving image:", error.message);
        res.status(500).json({ error: "Failed to serve image" });
    }
});
exports.default = router;
//# sourceMappingURL=photos.controller.js.map