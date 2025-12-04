export interface Category {
    id: number;
    user_id: string;
    name: string;
    description?: string;
    color?: string;
    created_at: Date;
}
export interface CreateCategoryData {
    name: string;
    description?: string;
    color?: string;
}
export declare class CategoriesService {
    createCategory(userId: string, categoryData: CreateCategoryData): Promise<Category>;
    getUserCategories(userId: string): Promise<Category[]>;
    categoryExists(categoryId: number, userId: string): Promise<boolean>;
    addAlbumCategory(albumId: number, categoryId: number, userId: string): Promise<any>;
    getAlbumCategories(albumId: number): Promise<Category[]>;
    removeAlbumCategory(albumId: number, categoryId: number, userId: string): Promise<boolean>;
    updateAlbumCategory(albumId: number, oldCategoryId: number, newCategoryId: number, userId: string): Promise<boolean>;
    getCategoryById(categoryId: number, userId: string): Promise<Category | null>;
    updateCategory(categoryId: number, categoryData: Partial<CreateCategoryData>, userId: string): Promise<Category>;
    deleteCategory(categoryId: number, userId: string): Promise<boolean>;
    getUserCategoriesWithSize(userId: string): Promise<Array<Category & {
        totalSize: number;
        albumCount: number;
        formattedSize: string;
    }>>;
    private formatBytes;
}
//# sourceMappingURL=categories.service.d.ts.map