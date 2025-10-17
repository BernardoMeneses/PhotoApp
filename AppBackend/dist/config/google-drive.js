"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.drive = exports.APP_FOLDER_NAME = void 0;
const googleapis_1 = require("googleapis");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
exports.APP_FOLDER_NAME = "PhotoApp";
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const serviceAccount = require(path_1.default.resolve(serviceAccountPath));
const auth = new googleapis_1.google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive"
    ],
});
exports.drive = googleapis_1.google.drive({ version: "v3", auth });
//# sourceMappingURL=google-drive.js.map