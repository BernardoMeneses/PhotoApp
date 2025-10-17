"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const albums_service_1 = require("./albums.service");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const photos_service_1 = require("../photos/photos.service");
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
const albumsService = new albums_service_1.AlbumsService();
const photosService = new photos_service_1.PhotosService();
router.post("/", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const { title, hexcolor, year, coverimage, categoryId } = req.body;
        if (!title || !hexcolor || !year) {
            return res.status(400).json({
                error: "Title, hexcolor, and year are required"
            });
        }
        if (!/^#[0-9A-F]{6}$/i.test(hexcolor)) {
            return res.status(400).json({
                error: "Invalid hex color format. Use #RRGGBB"
            });
        }
        if (categoryId !== undefined && categoryId !== null && categoryId !== "" && (typeof categoryId !== 'number' || categoryId <= 0)) {
            return res.status(400).json({
                error: "Invalid category ID"
            });
        }
        console.log("📁 Creating album for user:", req.user.uid);
        console.log("📝 Album data:", { title, hexcolor, year, coverimage, categoryId });
        let finalCoverImage = coverimage;
        if (!finalCoverImage) {
            try {
                const userPhotos = await photosService.listUserPhotos(req.user.uid);
                if (userPhotos.length > 0) {
                    const randomIndex = Math.floor(Math.random() * userPhotos.length);
                    finalCoverImage = userPhotos[randomIndex].url;
                    console.log("🎲 Using random user photo as cover:", finalCoverImage);
                }
            }
            catch (photoError) {
                console.log("⚠️ Could not get user photos for cover, using color only");
            }
        }
        const album = await albumsService.createAlbum(req.user.uid, req.user.email, {
            title,
            hexcolor,
            year,
            coverimage: finalCoverImage,
            categoryId: categoryId && categoryId !== "" ? categoryId : undefined
        });
        res.status(201).json({
            message: "Album created successfully",
            data: album
        });
    }
    catch (error) {
        console.error("❌ Create album error:", error.message);
        res.status(500).json({ error: error.message });
    }
});
router.get("/", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        console.log("📋 Getting albums with categories for user:", req.user.uid);
        const albums = await albumsService.getUserAlbumsWithCategories(req.user.uid);
        res.json({
            message: "Albums with categories retrieved successfully",
            data: albums,
            count: albums.length
        });
    }
    catch (error) {
        console.error("❌ Get albums error:", error.message);
        res.status(500).json({ error: error.message });
    }
});
router.get("/simple", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        console.log("📋 Getting simple albums for user:", req.user.uid);
        const albums = await albumsService.getUserAlbums(req.user.uid);
        res.json({
            message: "Albums retrieved successfully",
            data: albums,
            count: albums.length
        });
    }
    catch (error) {
        console.error("❌ Get simple albums error:", error.message);
        res.status(500).json({ error: error.message });
    }
});
router.get("/:id", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const albumId = parseInt(req.params.id);
        if (isNaN(albumId)) {
            return res.status(400).json({ error: "Invalid album ID" });
        }
        console.log("📖 Getting album:", albumId, "for user:", req.user.uid);
        const album = await albumsService.getAlbumById(albumId, req.user.uid);
        if (!album) {
            return res.status(404).json({ error: "Album not found" });
        }
        res.json({
            message: "Album retrieved successfully",
            data: album
        });
    }
    catch (error) {
        console.error("❌ Get album error:", error.message);
        res.status(500).json({ error: error.message });
    }
});
router.put("/:id", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const albumId = parseInt(req.params.id);
        if (isNaN(albumId)) {
            return res.status(400).json({ error: "Invalid album ID" });
        }
        const { title, hexcolor, coverimage, year, categoryId } = req.body;
        if (hexcolor && !/^#[0-9A-F]{6}$/i.test(hexcolor)) {
            return res.status(400).json({
                error: "Invalid hex color format. Use #RRGGBB"
            });
        }
        if (categoryId !== undefined && categoryId !== null && categoryId !== "" && (typeof categoryId !== 'number' || categoryId <= 0)) {
            return res.status(400).json({
                error: "Invalid category ID"
            });
        }
        console.log("✏️ Updating album:", albumId, "for user:", req.user.uid);
        console.log("📝 Update data:", { title, hexcolor, year, coverimage, categoryId });
        const updatedAlbum = await albumsService.updateAlbum(albumId, req.user.uid, {
            title,
            hexcolor,
            year,
            coverimage,
            categoryId: categoryId === "" ? null : categoryId
        });
        if (!updatedAlbum) {
            return res.status(404).json({ error: "Album not found" });
        }
        res.json({
            message: "Album updated successfully",
            data: updatedAlbum
        });
    }
    catch (error) {
        console.error("❌ Update album error:", error.message);
        res.status(500).json({ error: error.message });
    }
});
router.delete("/:id", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const albumId = parseInt(req.params.id);
        if (isNaN(albumId)) {
            return res.status(400).json({ error: "Invalid album ID" });
        }
        console.log("🗑️ Deleting album:", albumId, "for user:", req.user.uid);
        const deleted = await albumsService.deleteAlbum(albumId, req.user.uid);
        if (!deleted) {
            return res.status(404).json({ error: "Album not found" });
        }
        res.json({
            message: "Album deleted successfully"
        });
    }
    catch (error) {
        console.error("❌ Delete album error:", error.message);
        res.status(500).json({ error: error.message });
    }
});
router.get("/test/status", (req, res) => {
    res.json({
        message: "Albums module is working!",
        availableEndpoints: [
            "POST /albums - Create album (requires auth)",
            "GET /albums - Get user albums (requires auth)",
            "GET /albums/:id - Get specific album (requires auth)",
            "PUT /albums/:id - Update album (requires auth)",
            "DELETE /albums/:id - Delete album (requires auth)",
            "GET /albums/test/status - Test endpoint"
        ],
        authRequired: "Bearer <firebase_token>"
    });
});
router.post("/:id/photos", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const albumId = parseInt(req.params.id);
        const photoName = req.body?.photoName;
        const photoUrl = req.body?.photoUrl;
        console.log(`� Adding photo to album ${albumId}: ${photoName}`);
        if (!albumId || !photoName || !photoUrl) {
            return res.status(400).json({
                error: "albumId, photoName e photoUrl são obrigatórios"
            });
        }
        const added = await albumsService.addPhotoToAlbum(albumId, req.user.uid, photoName, photoUrl);
        res.json({ message: "Foto adicionada ao álbum", data: added });
    }
    catch (error) {
        console.error("❌ Add photo to album error:", error.message);
        res.status(500).json({ error: error.message });
    }
});
router.post("/:id/photos/batch", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const albumId = parseInt(req.params.id);
        const photos = req.body?.photos;
        if (!albumId || !photos || !Array.isArray(photos) || photos.length === 0) {
            return res.status(400).json({
                error: "albumId and photos array are required. Each photo must have photoName and photoUrl"
            });
        }
        const invalidPhotos = photos.filter((p) => !p.photoName || !p.photoUrl);
        if (invalidPhotos.length > 0) {
            return res.status(400).json({
                error: "All photos must have photoName and photoUrl properties"
            });
        }
        console.log(`📦 Batch adding ${photos.length} photos to album ${albumId}`);
        const results = await albumsService.batchAddPhotosToAlbum(albumId, req.user.uid, photos);
        res.json({
            message: `Batch add completed. Success: ${results.success.length}, Failed: ${results.failed.length}`,
            success: results.success,
            failed: results.failed
        });
    }
    catch (error) {
        console.error("❌ Batch add photos to album error:", error.message);
        res.status(500).json({ error: error.message });
    }
});
router.get("/:id/photos", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const albumId = parseInt(req.params.id);
        const photos = await albumsService.getAlbumPhotos(albumId, req.user.uid);
        res.json({ message: "Fotos do álbum", data: photos });
    }
    catch (error) {
        console.error("❌ Get album photos error:", error.message);
        res.status(500).json({ error: error.message });
    }
});
router.delete("/:id/photos/:photoName", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const albumId = parseInt(req.params.id);
        const { photoName } = req.params;
        const deleted = await albumsService.removePhotoFromAlbum(albumId, req.user.uid, photoName);
        res.json({ message: deleted ? "Foto removida" : "Foto não encontrada" });
    }
    catch (error) {
        console.error("❌ Remove photo from album error:", error.message);
        res.status(500).json({ error: error.message });
    }
});
router.get("/:id/categories", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const albumId = parseInt(req.params.id);
        if (isNaN(albumId)) {
            return res.status(400).json({ error: "Invalid album ID" });
        }
        const data = await albumsService.getAlbumWithCategories(albumId, req.user.uid);
        res.json({
            message: "Album categories retrieved successfully",
            data
        });
    }
    catch (error) {
        console.error("❌ Get album categories error:", error.message);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=albums.controller.js.map