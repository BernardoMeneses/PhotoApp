"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const database_1 = require("./config/database");
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const yamljs_1 = __importDefault(require("yamljs"));
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get("/ping", (req, res) => {
    res.json({ message: "Pong from backend 🚀" });
});
app.use("/uploads", express_1.default.static("uploads"));
app.use("/test", express_1.default.static(".", { index: "test-routes.html" }));
try {
    const swaggerPath = path_1.default.resolve(process.cwd(), "openapi.yaml");
    console.log("📘 Loading Swagger from:", swaggerPath);
    const spec = yamljs_1.default.load(swaggerPath);
    app.use("/docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(spec));
    console.log("✅ Swagger UI loaded at /docs");
}
catch (err) {
    console.error("❌ Error setting up Swagger UI:", err);
}
try {
    const photosRouter = require("./modules/photos/photos.controller").default;
    const authRouter = require("./modules/auth/auth.controller").default;
    const profileRouter = require("./modules/profile/profile.controller").default;
    const albumsRouter = require("./modules/albums/albums.controller").default;
    const categoriesRouter = require("./modules/categories/categories.controller").default;
    app.use("/", authRouter);
    app.use("/auth", authRouter);
    app.use("/photos", photosRouter);
    app.use("/profile", profileRouter);
    app.use("/albums", albumsRouter);
    app.use("/categories", categoriesRouter);
}
catch (error) {
    console.error("❌ Error loading routes:", error);
}
app.listen(PORT, async () => {
    console.log(`✅ Server running on http://localhost:${PORT}/docs`);
    try {
        await (0, database_1.testConnection)();
    }
    catch (error) {
        console.error('❌ Database connection failed:', error);
    }
});
//# sourceMappingURL=main.js.map