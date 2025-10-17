export declare class GoogleDriveService {
    private sharedDriveId;
    private userFolderCache;
    private ensureSharedDrive;
    private ensureUserFolder;
    uploadPhoto(file: Express.Multer.File, userId: string): Promise<{
        id: string | null | undefined;
        name: string | null | undefined;
        url: string;
        webViewLink: string | null | undefined;
        thumbnailLink: string | null | undefined;
    }>;
    listUserPhotos(userId: string): Promise<{
        id: string | null | undefined;
        name: string | null | undefined;
        url: string;
        webViewLink: string | null | undefined;
        thumbnailLink: string | null | undefined;
        created_at: string | null | undefined;
        mimeType: string | null | undefined;
    }[]>;
    deletePhoto(fileId: string): Promise<boolean>;
    deletePhotoByUrl(photoUrl: string): Promise<boolean>;
    listLibraryPhotos(userId: string): Promise<Record<string, Record<string, Record<string, any[]>>>>;
}
export declare const googleDriveService: GoogleDriveService;
//# sourceMappingURL=google-drive.service.d.ts.map