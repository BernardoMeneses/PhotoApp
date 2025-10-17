"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleDrivePhotosService = void 0;
const googledrive_1 = require("../config/googledrive");
const uuid_1 = require("uuid");
const stream_1 = require("stream");
class GoogleDrivePhotosService {
    constructor() {
        this.PHOTOS_FOLDER_NAME = 'PhotoApp_Photos';
    }
    getDriveForUser(userTokens) {
        return (0, googledrive_1.getDriveServiceForUser)(userTokens.accessToken, userTokens.refreshToken);
    }
    async createUserFolder(drive, userId) {
        try {
            const photosFolder = await this.findOrCreateFolder(drive, this.PHOTOS_FOLDER_NAME);
            const userFolderName = `user_${userId}`;
            const userFolder = await this.findOrCreateFolder(drive, userFolderName, photosFolder);
            return userFolder;
        }
        catch (error) {
            console.error('Error creating user folder:', error);
            throw new Error('Failed to create user folder');
        }
    }
    async findOrCreateFolder(drive, folderName, parentFolderId) {
        try {
            const query = parentFolderId
                ? `name='${folderName}' and parents in '${parentFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
                : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
            const response = await drive.files.list({
                q: query,
                fields: 'files(id, name)',
            });
            if (response.data.files && response.data.files.length > 0) {
                return response.data.files[0].id;
            }
            const folderMetadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: parentFolderId ? [parentFolderId] : undefined,
            };
            const folder = await drive.files.create({
                requestBody: folderMetadata,
                fields: 'id',
            });
            return folder.data.id;
        }
        catch (error) {
            console.error(`Error finding/creating folder ${folderName}:`, error);
            throw error;
        }
    }
    async uploadPhoto(file, userId, userTokens) {
        try {
            console.log('📤 Uploading photo to user Google Drive for user:', userId);
            const drive = this.getDriveForUser(userTokens);
            const userFolderId = await this.createUserFolder(drive, userId);
            const fileExtension = file.originalname.split('.').pop();
            const fileName = `${(0, uuid_1.v4)()}.${fileExtension}`;
            const bufferStream = new stream_1.Readable();
            bufferStream.push(file.buffer);
            bufferStream.push(null);
            const fileMetadata = {
                name: fileName,
                parents: [userFolderId],
            };
            const media = {
                mimeType: file.mimetype,
                body: bufferStream,
            };
            const response = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, name, size, webViewLink, webContentLink',
            });
            await drive.permissions.create({
                fileId: response.data.id,
                requestBody: {
                    role: 'reader',
                    type: 'anyone',
                },
            });
            const directLink = `https://drive.google.com/uc?id=${response.data.id}&export=view`;
            console.log('✅ Photo uploaded successfully to user Drive:', fileName);
            return {
                photoId: response.data.id,
                fileName: response.data.name,
                url: directLink,
                size: parseInt(response.data.size || '0'),
            };
        }
        catch (error) {
            console.error('❌ Error uploading photo to user Google Drive:', error);
            throw new Error('Failed to upload photo to user Google Drive');
        }
    }
    async listUserPhotos(userId, userTokens) {
        try {
            console.log('📋 Listing photos from user Google Drive for user:', userId);
            const drive = this.getDriveForUser(userTokens);
            const userFolderId = await this.createUserFolder(drive, userId);
            const response = await drive.files.list({
                q: `parents in '${userFolderId}' and mimeType contains 'image/' and trashed=false`,
                fields: 'files(id, name, size, createdTime, mimeType, webViewLink)',
                orderBy: 'createdTime desc',
            });
            if (!response.data.files) {
                console.log('✅ Photos listed successfully: 0 photos found');
                return [];
            }
            const photos = response.data.files.map((file) => ({
                id: file.id,
                name: file.name,
                url: `https://drive.google.com/uc?id=${file.id}&export=view`,
                size: parseInt(file.size || '0'),
                createdTime: file.createdTime,
                mimeType: file.mimeType,
            }));
            console.log(`✅ Photos listed successfully: ${photos.length} photos found`);
            return photos;
        }
        catch (error) {
            console.error('❌ Error listing user photos:', error);
            throw new Error('Failed to list user photos');
        }
    }
    async deletePhoto(fileId, userId, userTokens) {
        try {
            console.log('🗑️ Deleting photo from user Google Drive:', fileId, 'for user:', userId);
            const drive = this.getDriveForUser(userTokens);
            const userFolderId = await this.createUserFolder(drive, userId);
            const fileResponse = await drive.files.get({
                fileId: fileId,
                fields: 'parents',
            });
            if (!fileResponse.data.parents?.includes(userFolderId)) {
                throw new Error('Photo does not belong to user');
            }
            await drive.files.delete({
                fileId: fileId,
            });
            console.log('✅ Photo deleted successfully');
            return true;
        }
        catch (error) {
            console.error('❌ Error deleting photo:', error);
            if (error instanceof Error && error.message === 'Photo does not belong to user') {
                throw error;
            }
            throw new Error('Failed to delete photo');
        }
    }
    async getPhotoInfo(userId, photoId, userTokens) {
        try {
            const drive = this.getDriveForUser(userTokens);
            const userFolderId = await this.createUserFolder(drive, userId);
            const response = await drive.files.get({
                fileId: photoId,
                fields: 'id, name, size, createdTime, mimeType, parents, webViewLink',
            });
            if (!response.data.parents?.includes(userFolderId)) {
                return null;
            }
            return {
                id: response.data.id,
                name: response.data.name,
                url: `https://drive.google.com/uc?id=${response.data.id}&export=view`,
                size: parseInt(response.data.size || '0'),
                createdTime: response.data.createdTime,
                mimeType: response.data.mimeType,
            };
        }
        catch (error) {
            console.error('Error getting photo info:', error);
            return null;
        }
    }
    async getPhotoDownloadUrl(fileId) {
        try {
            console.log('🔗 Getting download URL from Google Drive for file:', fileId);
            const downloadUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;
            console.log('✅ Download URL generated successfully');
            return downloadUrl;
        }
        catch (error) {
            console.error('❌ Error getting download URL from Google Drive:', error.message);
            throw new Error(`Failed to get download URL: ${error.message}`);
        }
    }
}
exports.GoogleDrivePhotosService = GoogleDrivePhotosService;
//# sourceMappingURL=googledrive-photos.service.js.map