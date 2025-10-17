export interface PhotoUploadResult {
    photoId: string;
    fileName: string;
    url: string;
    size: number;
}
export interface PhotoInfo {
    id: string;
    name: string;
    url: string;
    size: number;
    createdTime: string;
    mimeType: string;
}
export declare class GoogleDrivePhotosService {
    private readonly PHOTOS_FOLDER_NAME;
    private getDriveForUser;
    private createUserFolder;
    private findOrCreateFolder;
    uploadPhoto(file: Express.Multer.File, userId: string, userTokens: {
        accessToken: string;
        refreshToken?: string;
    }): Promise<PhotoUploadResult>;
    listUserPhotos(userId: string, userTokens: {
        accessToken: string;
        refreshToken?: string;
    }): Promise<PhotoInfo[]>;
    deletePhoto(fileId: string, userId: string, userTokens: {
        accessToken: string;
        refreshToken?: string;
    }): Promise<boolean>;
    getPhotoInfo(userId: string, photoId: string, userTokens: {
        accessToken: string;
        refreshToken?: string;
    }): Promise<PhotoInfo | null>;
    getPhotoDownloadUrl(fileId: string): Promise<string>;
}
//# sourceMappingURL=googledrive-photos.service.d.ts.map