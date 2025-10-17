export interface User {
    id: string;
    email: string;
    password_hash?: string;
    created_at: Date;
}
export interface CreateUserData {
    id: string;
    email: string;
    password_hash?: string;
}
export declare class UsersService {
    userExists(userId: string): Promise<boolean>;
    getUserById(userId: string): Promise<User | null>;
    createUser(userData: CreateUserData): Promise<User>;
    ensureUserExists(userId: string, email: string): Promise<User>;
    updateUserEmail(userId: string, newEmail: string): Promise<User | null>;
}
//# sourceMappingURL=users.service.d.ts.map