import jwt from "jsonwebtoken";
interface AuthResult {
    user: {
        id: string;
        email: string;
    };
    token: string;
    idToken: string;
    refreshToken?: string;
}
export declare class AuthService {
    static generateToken(userId: string): string;
    static verifyToken(token: string): jwt.JwtPayload | string;
    static refreshFirebaseToken(refreshToken: string): Promise<{
        idToken: string;
        refreshToken: string;
        token: string;
        userId?: string;
        expiresIn?: string;
    }>;
    static signup(email: string, password: string): Promise<AuthResult>;
    static login(email: string, password: string): Promise<AuthResult>;
    static loginWithGoogle(googleIdToken: string): Promise<AuthResult>;
    static linkGoogleAccount(firebaseIdToken: string, googleIdToken: string): Promise<{
        message: string;
    }>;
}
export {};
//# sourceMappingURL=auth.service.d.ts.map