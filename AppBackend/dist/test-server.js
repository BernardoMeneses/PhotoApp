"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
const PORT = 3000;
app.get("/ping", (req, res) => {
    console.log("Ping request received!");
    res.json({ message: "Pong from backend 🚀" });
});
app.listen(PORT, () => {
    console.log(`✅ Simple server running at http://localhost:${PORT}`);
});
//# sourceMappingURL=test-server.js.map