interface GoogleDriveTokens {
    user_id: string;
    access_token: string;
    refresh_token?: string;
    token_type?: string;
    expiry_date?: number;
    scope?: string;
    created_at?: Date;
    updated_at?: Date;
}
export declare class GoogleDriveTokenService {
    static createTableIfNotExists(): Promise<void>;
    static saveTokens(userId: string, tokens: any): Promise<void>;
    static loadTokens(userId: string): Promise<GoogleDriveTokens | null>;
    static hasTokens(userId: string): Promise<boolean>;
    static deleteTokens(userId: string): Promise<boolean>;
    static updateAccessToken(userId: string, accessToken: string, expiryDate?: number): Promise<void>;
    static getUsersWithTokens(): Promise<string[]>;
    static getExpiredTokens(): Promise<string[]>;
}
export {};
//# sourceMappingURL=google-drive-token.service.d.ts.map