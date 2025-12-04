"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileService = void 0;
const database_1 = require("../../config/database");
const google_drive_service_1 = require("../../services/google-drive.service");
const axios_1 = __importDefault(require("axios"));
class ProfileService {
    static async getGoogleDriveUsage(userId) {
        if (!userId)
            throw new Error("User not authenticated");
        const result = await database_1.pool.query("SELECT google_drive_access_token, google_drive_refresh_token FROM users WHERE id = $1", [userId]);
        const row = result.rows[0];
        if (!row || !row.google_drive_access_token) {
            throw new Error("Google Drive not connected");
        }
        const tokens = {
            access_token: row.google_drive_access_token,
            refresh_token: row.google_drive_refresh_token,
        };
        const googleDriveService = new google_drive_service_1.GoogleDriveService();
        const drive = googleDriveService["createDriveClient"](tokens);
        const about = await drive.about.get({ fields: "storageQuota" });
        console.log("[GoogleDrive] about.data:", about.data);
        const quota = about.data.storageQuota;
        if (!quota) {
            throw new Error("Não foi possível obter a quota do Google Drive. Verifique se a conta está conectada corretamente e se o token tem permissão.");
        }
        return {
            used: Number(quota.usage || 0),
            total: Number(quota.limit || 15 * 1024 * 1024 * 1024),
        };
    }
    static async getCurrentProfile(idToken) {
        try {
            const apiKey = process.env.FIREBASE_API_KEY;
            if (!apiKey) {
                throw new Error("FIREBASE_API_KEY is not defined in environment variables");
            }
            const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
            const response = await axios_1.default.post(url, {
                idToken: idToken
            });
            if (!response.data.users || response.data.users.length === 0) {
                throw new Error("User not found");
            }
            return response.data.users[0];
        }
        catch (error) {
            if (error.response?.data?.error) {
                const firebaseError = error.response.data.error;
                switch (firebaseError.message) {
                    case 'INVALID_ID_TOKEN':
                        throw new Error("Invalid or expired token");
                    case 'USER_NOT_FOUND':
                        throw new Error("User not found");
                    default:
                        throw new Error(`Firebase error: ${firebaseError.message}`);
                }
            }
            throw new Error("Failed to fetch user profile");
        }
    }
    static async updateProfile(idToken, updateData) {
        try {
            const apiKey = process.env.FIREBASE_API_KEY;
            if (!apiKey) {
                throw new Error("FIREBASE_API_KEY is not defined in environment variables");
            }
            const url = `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`;
            const requestData = {
                idToken: idToken,
                returnSecureToken: true
            };
            if (updateData.email) {
                requestData.email = updateData.email;
            }
            if (updateData.password) {
                requestData.password = updateData.password;
            }
            const response = await axios_1.default.post(url, requestData);
            return {
                localId: response.data.localId,
                email: response.data.email,
                emailVerified: response.data.emailVerified || false,
                providerUserInfo: response.data.providerUserInfo || [],
                validSince: response.data.validSince || "",
                disabled: false,
                lastLoginAt: response.data.lastLoginAt || "",
                createdAt: response.data.createdAt || ""
            };
        }
        catch (error) {
            if (error.response?.data?.error) {
                const firebaseError = error.response.data.error;
                switch (firebaseError.message) {
                    case 'INVALID_ID_TOKEN':
                        throw new Error("Invalid or expired token");
                    case 'EMAIL_EXISTS':
                        throw new Error("Email already exists");
                    case 'WEAK_PASSWORD':
                        throw new Error("Password is too weak");
                    case 'INVALID_EMAIL':
                        throw new Error("Invalid email format");
                    case 'USER_NOT_FOUND':
                        throw new Error("User not found");
                    default:
                        throw new Error(`Firebase error: ${firebaseError.message}`);
                }
            }
            throw new Error("Failed to update user profile");
        }
    }
    static async updateEmail(idToken, newEmail) {
        return this.updateProfile(idToken, { email: newEmail });
    }
    static async updatePassword(idToken, currentPassword, newPassword) {
        try {
            const apiKey = process.env.FIREBASE_API_KEY;
            if (!apiKey) {
                throw new Error("FIREBASE_API_KEY is not defined in environment variables");
            }
            const currentProfile = await this.getCurrentProfile(idToken);
            const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
            await axios_1.default.post(signInUrl, {
                email: currentProfile.email,
                password: currentPassword,
                returnSecureToken: true
            });
            const updateUrl = `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`;
            const response = await axios_1.default.post(updateUrl, {
                idToken: idToken,
                password: newPassword,
                returnSecureToken: true
            });
            return {
                idToken: response.data.idToken,
                userData: {
                    localId: response.data.localId,
                    email: response.data.email,
                    emailVerified: response.data.emailVerified || false,
                    providerUserInfo: response.data.providerUserInfo || [],
                    validSince: response.data.validSince || "",
                    disabled: false,
                    lastLoginAt: response.data.lastLoginAt || "",
                    createdAt: response.data.createdAt || ""
                }
            };
        }
        catch (error) {
            if (error.response?.data?.error) {
                const firebaseError = error.response.data.error;
                switch (firebaseError.message) {
                    case 'INVALID_PASSWORD':
                        throw new Error("Current password is incorrect");
                    case 'INVALID_ID_TOKEN':
                        throw new Error("Invalid or expired token");
                    case 'WEAK_PASSWORD':
                        throw new Error("New password is too weak (minimum 6 characters)");
                    case 'USER_NOT_FOUND':
                        throw new Error("User not found");
                    default:
                        throw new Error(`Firebase error: ${firebaseError.message}`);
                }
            }
            throw new Error("Failed to update password");
        }
    }
    static async sendEmailVerification(idToken) {
        try {
            const apiKey = process.env.FIREBASE_API_KEY;
            if (!apiKey) {
                throw new Error("FIREBASE_API_KEY is not defined in environment variables");
            }
            const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`;
            await axios_1.default.post(url, {
                requestType: "VERIFY_EMAIL",
                idToken: idToken
            });
        }
        catch (error) {
            if (error.response?.data?.error) {
                const firebaseError = error.response.data.error;
                throw new Error(`Firebase error: ${firebaseError.message}`);
            }
            throw new Error("Failed to send email verification");
        }
    }
    static async deleteAccount(idToken) {
        try {
            const apiKey = process.env.FIREBASE_API_KEY;
            if (!apiKey) {
                throw new Error("FIREBASE_API_KEY is not defined in environment variables");
            }
            const url = `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`;
            await axios_1.default.post(url, {
                idToken: idToken
            });
        }
        catch (error) {
            if (error.response?.data?.error) {
                const firebaseError = error.response.data.error;
                throw new Error(`Firebase error: ${firebaseError.message}`);
            }
            throw new Error("Failed to delete user account");
        }
    }
}
exports.ProfileService = ProfileService;
//# sourceMappingURL=profile.service.js.map