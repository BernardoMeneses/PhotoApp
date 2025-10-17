"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const auth_controller_1 = __importDefault(require("../auth/auth.controller"));
const photos_controller_1 = __importDefault(require("./photos.controller"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
app.use(express_1.default.json());
app.get("/", (req, res) => {
    res.json({ message: "Backend API online 🚀" });
});
app.use("/auth", auth_controller_1.default);
app.use("/photos", photos_controller_1.default);
exports.default = app;
//# sourceMappingURL=index.js.map