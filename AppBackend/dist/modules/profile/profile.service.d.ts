interface FirebaseUserData {
    localId: string;
    email: string;
    emailVerified: boolean;
    providerUserInfo: any[];
    validSince: string;
    disabled: boolean;
    lastLoginAt: string;
    createdAt: string;
}
interface UpdateProfileData {
    email?: string;
    password?: string;
    displayName?: string;
}
export declare class ProfileService {
    static getCurrentProfile(idToken: string): Promise<FirebaseUserData>;
    static updateProfile(idToken: string, updateData: UpdateProfileData): Promise<FirebaseUserData>;
    static updateEmail(idToken: string, newEmail: string): Promise<FirebaseUserData>;
    static updatePassword(idToken: string, currentPassword: string, newPassword: string): Promise<{
        idToken: string;
        userData: FirebaseUserData;
    }>;
    static sendEmailVerification(idToken: string): Promise<void>;
    static deleteAccount(idToken: string): Promise<void>;
}
export {};
//# sourceMappingURL=profile.service.d.ts.map