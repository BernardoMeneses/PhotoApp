"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleDriveService = exports.GoogleDriveService = void 0;
const googleapis_1 = require("googleapis");
const stream_1 = require("stream");
class GoogleDriveService {
    constructor() {
        this.SCOPES = ['https://www.googleapis.com/auth/drive.file'];
        this.oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_DRIVE_CLIENT_ID, process.env.GOOGLE_DRIVE_CLIENT_SECRET, process.env.GOOGLE_DRIVE_REDIRECT_URI);
    }
    getAuthUrl() {
        const authUrl = this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: this.SCOPES,
            prompt: 'consent',
            redirect_uri: process.env.GOOGLE_DRIVE_REDIRECT_URI
        });
        console.log('🔗 URL de autenticação gerada:', authUrl);
        return authUrl;
    }
    createDriveClient(tokens) {
        this.oauth2Client.setCredentials(tokens);
        return googleapis_1.google.drive({ version: 'v3', auth: this.oauth2Client });
    }
    async exchangeCodeForTokens(code) {
        try {
            const { tokens } = await this.oauth2Client.getToken({
                code,
                redirect_uri: process.env.GOOGLE_DRIVE_REDIRECT_URI
            });
            console.log('🔑 Tokens obtidos do Google:', tokens);
            return tokens;
        }
        catch (error) {
            console.error('❌ Erro ao trocar código por tokens:', error.message);
            throw new Error('Failed to exchange code for tokens');
        }
    }
    async ensureAppFolder(tokens, folderName = 'PhotoApp') {
        const drive = this.createDriveClient(tokens);
        try {
            const query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`;
            const response = await drive.files.list({
                q: query,
                fields: 'files(id, name)',
                spaces: 'drive'
            });
            if (response.data.files && response.data.files.length > 0) {
                console.log(`📁 Pasta '${folderName}' encontrada:`, response.data.files[0].id);
                return response.data.files[0].id;
            }
            const folderResponse = await drive.files.create({
                requestBody: {
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder'
                },
                fields: 'id'
            });
            console.log(`📁 Pasta '${folderName}' criada:`, folderResponse.data.id);
            return folderResponse.data.id;
        }
        catch (error) {
            console.error('❌ Erro ao criar/encontrar pasta:', error.message);
            throw new Error('Failed to ensure app folder');
        }
    }
    async uploadPhoto(tokens, fileName, fileBuffer, mimeType, folderId) {
        const drive = this.createDriveClient(tokens);
        try {
            if (!folderId) {
                folderId = await this.ensureAppFolder(tokens);
            }
            const media = {
                mimeType: mimeType,
                body: stream_1.Readable.from(fileBuffer)
            };
            const fileMetadata = {
                name: fileName,
                parents: [folderId]
            };
            const response = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, name, webViewLink, webContentLink'
            });
            console.log(`📤 Foto '${fileName}' uploaded para Google Drive:`, response.data.id);
            return {
                id: response.data.id,
                name: response.data.name,
                webViewLink: response.data.webViewLink,
                webContentLink: response.data.webContentLink
            };
        }
        catch (error) {
            console.error('❌ Erro ao fazer upload para Google Drive:', error.message);
            throw new Error('Failed to upload photo to Google Drive');
        }
    }
    async listPhotos(tokens, folderId) {
        const drive = this.createDriveClient(tokens);
        try {
            if (!folderId) {
                folderId = await this.ensureAppFolder(tokens);
            }
            const response = await drive.files.list({
                q: `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`,
                fields: 'files(id, name, webViewLink, webContentLink, createdTime, size)',
                orderBy: 'createdTime desc'
            });
            console.log(`📋 Encontradas ${response.data.files?.length || 0} fotos no Google Drive`);
            return response.data.files?.map(file => ({
                id: file.id,
                name: file.name,
                webViewLink: file.webViewLink,
                webContentLink: file.webContentLink,
                createdTime: file.createdTime,
                size: file.size
            })) || [];
        }
        catch (error) {
            console.error('❌ Erro ao listar fotos do Google Drive:', error.message);
            throw new Error('Failed to list photos from Google Drive');
        }
    }
    async deletePhoto(tokens, fileId) {
        const drive = this.createDriveClient(tokens);
        try {
            await drive.files.delete({
                fileId: fileId
            });
            console.log(`🗑️ Foto deletada do Google Drive:`, fileId);
            return true;
        }
        catch (error) {
            console.error('❌ Erro ao deletar foto do Google Drive:', error.message);
            if (error.code === 404) {
                console.log('📝 Arquivo não encontrado, considerando como deletado');
                return true;
            }
            return false;
        }
    }
    async batchDeletePhotos(tokens, fileIds) {
        const results = {
            success: [],
            failed: []
        };
        for (const fileId of fileIds) {
            try {
                const deleted = await this.deletePhoto(tokens, fileId);
                if (deleted) {
                    results.success.push(fileId);
                }
                else {
                    results.failed.push(fileId);
                }
            }
            catch (error) {
                console.error(`❌ Falha ao deletar ${fileId}:`, error);
                results.failed.push(fileId);
            }
        }
        return results;
    }
    async getPhotoDownloadUrl(tokens, fileId) {
        const drive = this.createDriveClient(tokens);
        try {
            const response = await drive.files.get({
                fileId: fileId,
                alt: 'media'
            }, {
                responseType: 'stream'
            });
            return `https://drive.google.com/uc?id=${fileId}&export=download`;
        }
        catch (error) {
            console.error('❌ Erro ao obter URL de download:', error.message);
            throw new Error('Failed to get download URL');
        }
    }
    async validateTokens(tokens) {
        try {
            const drive = this.createDriveClient(tokens);
            await drive.files.list({ pageSize: 1 });
            return true;
        }
        catch (error) {
            console.error('❌ Tokens inválidos ou expirados:', error.message);
            return false;
        }
    }
    async refreshTokens(refreshToken) {
        try {
            this.oauth2Client.setCredentials({
                refresh_token: refreshToken
            });
            const { credentials } = await this.oauth2Client.refreshAccessToken();
            console.log('🔄 Tokens refreshed com sucesso');
            return credentials;
        }
        catch (error) {
            console.error('❌ Erro ao refresh tokens:', error.message);
            throw new Error('Failed to refresh tokens');
        }
    }
}
exports.GoogleDriveService = GoogleDriveService;
exports.googleDriveService = new GoogleDriveService();
//# sourceMappingURL=google-drive.service.js.map