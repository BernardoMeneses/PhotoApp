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
    savePhotoMetadata(userId: string, photoId: string, photoName: string, photoUrl: string, status?: 'unsorted' | 'library' | 'album'): Promise<void>;
    listUnsortedPhotos(userId: string): Promise<{
        id: any;
        name: any;
        url: any;
        thumbnailUrl: string;
        fullUrl: string;
        driveId: any;
        source: string;
        createdTime: any;
        uploadedAt: any;
        status: string;
    }[]>;
    listLibraryPhotos(userId: string): Promise<Record<string, Record<string, Record<string, any[]>>>>;
    movePhotosToLibrary(userId: string, photoIds: string[]): Promise<{
        success: boolean;
        moved: number;
    }>;
    movePhotosToUnsorted(userId: string, photoIds: string[]): Promise<{
        success: boolean;
        moved: number;
    }>;
    deleteUserPhoto(photoId: string, userId: string): Promise<boolean>;
    deletePhotoByUrl(photoUrl: string, userId: string): Promise<boolean>;
    batchDeletePhotos(photoIdentifiers: string[], userId: string): Promise<{
        success: string[];
        failed: string[];
    }>;
}
//# sourceMappingURL=photos.service.d.ts.map