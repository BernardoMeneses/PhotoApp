"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bucket = exports.gcpStorage = void 0;
const storage_1 = require("@google-cloud/storage");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.gcpStorage = new storage_1.Storage({
    projectId: process.env.GCP_PROJECT_ID,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});
exports.bucket = exports.gcpStorage.bucket(process.env.GCP_BUCKET);
//# sourceMappingURL=gcp.js.map