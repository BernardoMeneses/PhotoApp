export interface UserGoogleTokens {
    id?: number;
    userId: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    scope?: string;
    createdAt?: Date;
    updatedAt?: Date;
}
export declare class GoogleTokensService {
    saveUserTokens(userId: string, tokens: {
        access_token: string;
        refresh_token?: string;
        expiry_date?: number;
        scope?: string;
    }): Promise<void>;
    getUserTokens(userId: string): Promise<UserGoogleTokens | null>;
    hasValidTokens(userId: string): Promise<boolean>;
    removeUserTokens(userId: string): Promise<void>;
    getAllUsersWithTokens(): Promise<string[]>;
}
//# sourceMappingURL=google-tokens.service.d.ts.map