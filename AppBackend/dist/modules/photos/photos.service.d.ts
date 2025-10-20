export declare class PhotosService {
    uploadPhoto(file: Express.Multer.File): Promise<void>;
    uploadPhotosWithUser(files: Express.Multer.File[], userId: string): Promise<{
        id: string;
        name: string;
        url: string;
        thumbnailUrl: string;
        fullUrl: string;
        driveId: string;
        source: string;
    }[]>;
    listAllPhotos(): Promise<void>;
    listUserPhotos(userId: string): Promise<{
        id: string;
        name: string;
        url: string;
        thumbnailUrl: string;
        fullUrl: string;
        driveId: string;
        source: string;
        createdTime: string;
        size: string;
    }[]>;
    deleteUserPhoto(photoId: string, userId: string): Promise<boolean>;
    deletePhotoByUrl(photoUrl: string, userId: string): Promise<boolean>;
    listLibraryPhotos(userId: string): Promise<Record<string, Record<string, Record<string, any[]>>>>;
    batchDeletePhotos(photoIdentifiers: string[], userId: string): Promise<{
        success: string[];
        failed: string[];
    }>;
}
//# sourceMappingURL=photos.service.d.ts.map