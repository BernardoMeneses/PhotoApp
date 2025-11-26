export interface Album {
    id: number;
    user_id: string;
    title: string;
    hexcolor: string;
    year: number;
    coverimage: string | null;
    created_at: Date;
}
export interface CreateAlbumData {
    title: string;
    hexcolor: string;
    year: number;
    coverimage?: string;
    categoryId?: number;
}
export declare class AlbumsService {
    private usersService;
    private categoriesService;
    constructor();
    createAlbum(userId: string, userEmail: string, albumData: CreateAlbumData): Promise<Album>;
    getUserAlbums(userId: string): Promise<Album[]>;
    getUserAlbumsWithCategories(userId: string): Promise<any[]>;
    getAlbumById(albumId: number, userId: string): Promise<Album | null>;
    updateAlbum(albumId: number, userId: string, updateData: Partial<CreateAlbumData>): Promise<Album | null>;
    deleteAlbum(albumId: number, userId: string): Promise<boolean>;
    getRandomUserPhoto(userId: string): Promise<string | null>;
    addPhotoToAlbum(albumId: number, userId: string, photoName: string, photoUrl: string): Promise<any>;
    getAlbumPhotos(albumId: number, userId: string): Promise<any[]>;
    removePhotoFromAlbum(albumId: number, userId: string, photoName: string): Promise<boolean>;
    getAlbumWithCategories(albumId: number, userId: string): Promise<{
        categories: any[];
        id: number;
        user_id: string;
        title: string;
        hexcolor: string;
        year: number;
        coverimage: string | null;
        created_at: Date;
    } | null>;
    batchAddPhotosToAlbum(albumId: number, userId: string, photos: Array<{
        photoName: string;
        photoUrl: string;
    }>): Promise<{
        success: Array<any>;
        failed: Array<{
            photoName: string;
            error: string;
        }>;
    }>;
    getAlbumTotalSize(albumId: number, userId: string): Promise<{
        totalSize: number;
        photoCount: number;
        formattedSize: string;
    }>;
    private formatBytes;
    close(): Promise<void>;
}
//# sourceMappingURL=albums.service.d.ts.map