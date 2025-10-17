interface GoogleTokens {
    access_token: string;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
    expiry_date?: number;
}
export declare class GoogleDriveService {
    private oauth2Client;
    private readonly SCOPES;
    constructor();
    getAuthUrl(): string;
    private createDriveClient;
    exchangeCodeForTokens(code: string): Promise<GoogleTokens>;
    ensureAppFolder(tokens: GoogleTokens, folderName?: string): Promise<string>;
    uploadPhoto(tokens: GoogleTokens, fileName: string, fileBuffer: Buffer, mimeType: string, folderId?: string): Promise<{
        id: string;
        name: string;
        webViewLink: string;
        webContentLink: string;
    }>;
    listPhotos(tokens: GoogleTokens, folderId?: string): Promise<Array<{
        id: string;
        name: string;
        webViewLink: string;
        webContentLink: string;
        createdTime: string;
        size: string;
    }>>;
    deletePhoto(tokens: GoogleTokens, fileId: string): Promise<boolean>;
    batchDeletePhotos(tokens: GoogleTokens, fileIds: string[]): Promise<{
        success: string[];
        failed: string[];
    }>;
    getPhotoDownloadUrl(tokens: GoogleTokens, fileId: string): Promise<string>;
    validateTokens(tokens: GoogleTokens): Promise<boolean>;
    refreshTokens(refreshToken: string): Promise<GoogleTokens>;
}
export declare const googleDriveService: GoogleDriveService;
export {};
//# sourceMappingURL=google-drive.service.d.ts.map