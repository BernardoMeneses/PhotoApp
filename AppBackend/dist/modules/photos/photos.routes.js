"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
const UPLOADS_DIR = path_1.default.join(__dirname, "../../../uploads");
if (!fs_1.default.existsSync(UPLOADS_DIR)) {
    fs_1.default.mkdirSync(UPLOADS_DIR, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = (0, multer_1.default)({ storage });
router.get("/", (req, res) => {
    const files = fs_1.default.readdirSync(UPLOADS_DIR);
    res.json(files.map(file => ({ name: file, url: `/uploads/${file}` })));
});
router.post("/upload", upload.single("photo"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }
    res.json({
        message: "Upload successful",
        file: {
            name: req.file.filename,
            url: `/uploads/${req.file.filename}`,
        },
    });
});
router.delete("/:filename", (req, res) => {
    const { filename } = req.params;
    const filePath = path_1.default.join(UPLOADS_DIR, filename);
    if (!fs_1.default.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
    }
    fs_1.default.unlinkSync(filePath);
    res.json({ message: "File deleted successfully" });
});
exports.default = router;
//# sourceMappingURL=photos.routes.js.map