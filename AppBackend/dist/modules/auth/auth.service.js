"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const axios_1 = __importDefault(require("axios"));
class AuthService {
    static generateToken(userId) {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error("JWT_SECRET is not defined in environment variables");
        }
        const expiresIn = process.env.JWT_EXPIRES_IN || "1d";
        return jsonwebtoken_1.default.sign({ id: userId }, secret, { expiresIn });
    }
    static verifyToken(token) {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error("JWT_SECRET is not defined in environment variables");
        }
        try {
            return jsonwebtoken_1.default.verify(token, secret);
        }
        catch (error) {
            throw new Error("Invalid or expired token");
        }
    }
    static async refreshFirebaseToken(refreshToken) {
        try {
            const apiKey = process.env.FIREBASE_API_KEY;
            if (!apiKey) {
                throw new Error("FIREBASE_API_KEY is not defined in environment variables");
            }
            const url = `https://securetoken.googleapis.com/v1/token?key=${apiKey}`;
            const params = new URLSearchParams();
            params.append('grant_type', 'refresh_token');
            params.append('refresh_token', refreshToken);
            const response = await axios_1.default.post(url, params.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            const idToken = response.data.id_token;
            const newRefreshToken = response.data.refresh_token;
            const userId = response.data.user_id;
            const expiresIn = response.data.expires_in;
            const token = userId ? this.generateToken(userId) : this.generateToken('');
            return { idToken, refreshToken: newRefreshToken, token, userId, expiresIn };
        }
        catch (error) {
            console.error('❌ Error refreshing Firebase token:', error.response?.data || error.message);
            throw new Error('Failed to refresh token');
        }
    }
    static async signup(email, password) {
        try {
            const apiKey = process.env.FIREBASE_API_KEY;
            if (!apiKey) {
                throw new Error("FIREBASE_API_KEY is not defined in environment variables");
            }
            const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
            const response = await axios_1.default.post(url, {
                email,
                password,
                returnSecureToken: true
            });
            const { localId, email: userEmail, idToken, refreshToken } = response.data;
            const token = this.generateToken(localId);
            return {
                user: { id: localId, email: userEmail },
                token,
                idToken,
                refreshToken
            };
        }
        catch (error) {
            if (error.response?.data?.error) {
                const firebaseError = error.response.data.error;
                switch (firebaseError.message) {
                    case 'EMAIL_EXISTS':
                        throw new Error("Email already exists");
                    case 'WEAK_PASSWORD':
                        throw new Error("Password is too weak");
                    case 'INVALID_EMAIL':
                        throw new Error("Invalid email format");
                    default:
                        throw new Error(`Firebase error: ${firebaseError.message}`);
                }
            }
            if (error.code === 'ECONNREFUSED') {
                throw new Error("Unable to connect to Firebase. Check your internet connection.");
            }
            throw new Error("Failed to create user account");
        }
    }
    static async login(email, password) {
        try {
            const apiKey = process.env.FIREBASE_API_KEY;
            if (!apiKey) {
                throw new Error("FIREBASE_API_KEY is not defined in environment variables");
            }
            const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
            const response = await axios_1.default.post(url, {
                email,
                password,
                returnSecureToken: true
            });
            const { localId, email: userEmail, idToken, refreshToken } = response.data;
            const token = this.generateToken(localId);
            return {
                user: { id: localId, email: userEmail },
                token,
                idToken,
                refreshToken
            };
        }
        catch (error) {
            if (error.response?.data?.error) {
                const firebaseError = error.response.data.error;
                switch (firebaseError.message) {
                    case 'EMAIL_NOT_FOUND':
                        throw new Error("No user found with this email");
                    case 'INVALID_PASSWORD':
                        throw new Error("Invalid password");
                    case 'USER_DISABLED':
                        throw new Error("User account has been disabled");
                    case 'INVALID_EMAIL':
                        throw new Error("Invalid email format");
                    default:
                        throw new Error(`Firebase error: ${firebaseError.message}`);
                }
            }
            if (error.code === 'ECONNREFUSED') {
                throw new Error("Unable to connect to Firebase. Check your internet connection.");
            }
            throw new Error("Failed to authenticate user");
        }
    }
    static async loginWithGoogle(googleIdToken) {
        try {
            console.log('🔵 Starting Google authentication...');
            const apiKey = process.env.FIREBASE_API_KEY;
            if (!apiKey) {
                console.error('❌ FIREBASE_API_KEY not found in environment');
                throw new Error("FIREBASE_API_KEY is not defined in environment variables");
            }
            console.log('✅ Firebase API Key found');
            console.log('🔵 Token length:', googleIdToken.length);
            const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${apiKey}`;
            const requestBody = {
                postBody: `id_token=${googleIdToken}&providerId=google.com`,
                requestUri: process.env.FIREBASE_AUTH_DOMAIN || 'http://localhost:3000',
                returnSecureToken: true,
                returnIdpCredential: true
            };
            console.log('🔵 Making request to Firebase with requestUri:', requestBody.requestUri);
            const response = await axios_1.default.post(url, requestBody);
            console.log('✅ Firebase response received');
            console.log('📦 Response data keys:', Object.keys(response.data));
            const { localId, email, idToken, refreshToken } = response.data;
            if (!email) {
                console.error('❌ No email in Firebase response');
                throw new Error("Google account does not have an email address");
            }
            const token = this.generateToken(localId);
            console.log('✅ Google authentication successful for:', email);
            console.log('👤 User ID:', localId);
            return {
                user: { id: localId, email },
                token,
                idToken,
                refreshToken
            };
        }
        catch (error) {
            console.error('❌ Google authentication error');
            console.error('📋 Error message:', error.message);
            console.error('📋 Error code:', error.code);
            if (error.response) {
                console.error('📋 Response status:', error.response.status);
                console.error('📋 Response data:', JSON.stringify(error.response.data, null, 2));
            }
            if (error.response?.data?.error) {
                const firebaseError = error.response.data.error;
                console.error('🔥 Firebase error message:', firebaseError.message);
                switch (firebaseError.message) {
                    case 'INVALID_IDP_RESPONSE':
                        throw new Error("Invalid Google token - the token may have expired or is malformed");
                    case 'USER_DISABLED':
                        throw new Error("User account has been disabled");
                    case 'FEDERATED_USER_ID_ALREADY_LINKED':
                        throw new Error("This Google account is already linked to another user");
                    default:
                        throw new Error(`Firebase error: ${firebaseError.message}`);
                }
            }
            if (error.code === 'ECONNREFUSED') {
                throw new Error("Unable to connect to Firebase. Check your internet connection.");
            }
            throw new Error(`Failed to authenticate with Google: ${error.message}`);
        }
    }
    static async linkGoogleAccount(firebaseIdToken, googleIdToken) {
        try {
            const apiKey = process.env.FIREBASE_API_KEY;
            if (!apiKey) {
                throw new Error("FIREBASE_API_KEY is not defined in environment variables");
            }
            const url = `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`;
            await axios_1.default.post(url, {
                idToken: firebaseIdToken,
                linkIdToken: googleIdToken,
                returnSecureToken: true
            });
            console.log('✅ Google account linked successfully');
            return {
                message: "Google account linked successfully. You can now login with Google."
            };
        }
        catch (error) {
            console.error('❌ Link Google account error:', error.response?.data || error.message);
            if (error.response?.data?.error) {
                const firebaseError = error.response.data.error;
                switch (firebaseError.message) {
                    case 'CREDENTIAL_TOO_OLD_LOGIN_AGAIN':
                        throw new Error("Please login again to link Google account");
                    case 'TOKEN_EXPIRED':
                        throw new Error("Session expired. Please login again");
                    case 'FEDERATED_USER_ID_ALREADY_LINKED':
                        throw new Error("This Google account is already linked to another user");
                    default:
                        throw new Error(`Firebase error: ${firebaseError.message}`);
                }
            }
            throw new Error("Failed to link Google account");
        }
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map