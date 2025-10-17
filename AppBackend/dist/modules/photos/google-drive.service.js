"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleDriveService = exports.GoogleDriveService = void 0;
const google_drive_1 = require("../../config/google-drive");
const stream_1 = require("stream");
class GoogleDriveService {
    constructor() {
        this.sharedDriveId = null;
        this.userFolderCache = new Map();
    }
    async ensureSharedDrive() {
        if (this.sharedDriveId) {
            return this.sharedDriveId;
        }
        try {
            console.log(`🔍 Procurando Shared Drive "${google_drive_1.APP_FOLDER_NAME}"...`);
            const listResponse = await google_drive_1.drive.drives.list({
                q: `name='${google_drive_1.APP_FOLDER_NAME}'`,
                fields: "drives(id, name)",
            });
            if (listResponse.data.drives && listResponse.data.drives.length > 0) {
                this.sharedDriveId = listResponse.data.drives[0].id;
                console.log(`✅ Shared Drive "${google_drive_1.APP_FOLDER_NAME}" encontrado: ${this.sharedDriveId}`);
                return this.sharedDriveId;
            }
            else {
                const errorMsg = `
❌ Shared Drive "${google_drive_1.APP_FOLDER_NAME}" não encontrado!

📋 PASSOS NECESSÁRIOS:
1. Acede ao Google Drive: https://drive.google.com
2. Clica em "Shared drives" no menu lateral
3. Cria um novo Shared Drive com o nome: "${google_drive_1.APP_FOLDER_NAME}"
4. Adiciona a Service Account como membro:
   Email: firebase-adminsdk-fbsvc@photoapp-4412c.iam.gserviceaccount.com
   Permissão: Content Manager ou Manager
5. Reinicia o servidor e tenta novamente

⚠️ Nota: Shared Drives só estão disponíveis em contas Google Workspace.
   Se tens uma conta Gmail pessoal, consulta o ficheiro COMO_CRIAR_SHARED_DRIVE.md
`;
                console.error(errorMsg);
                throw new Error(`Shared Drive "${google_drive_1.APP_FOLDER_NAME}" não encontrado. Por favor, cria-o manualmente primeiro.`);
            }
        }
        catch (error) {
            console.error("❌ Erro ao procurar Shared Drive:", error.message);
            throw new Error(`Falha ao encontrar Shared Drive: ${error.message}`);
        }
    }
    async ensureUserFolder(userId) {
        if (this.userFolderCache.has(userId)) {
            return this.userFolderCache.get(userId);
        }
        try {
            const sharedDriveId = await this.ensureSharedDrive();
            const response = await google_drive_1.drive.files.list({
                q: `name='${userId}' and '${sharedDriveId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: "files(id, name)",
                corpora: "drive",
                driveId: sharedDriveId,
                includeItemsFromAllDrives: true,
                supportsAllDrives: true,
            });
            let userFolderId;
            if (response.data.files && response.data.files.length > 0) {
                userFolderId = response.data.files[0].id;
                console.log(`✅ Pasta do utilizador encontrada: ${userId}`);
            }
            else {
                const folderMetadata = {
                    name: userId,
                    mimeType: "application/vnd.google-apps.folder",
                    parents: [sharedDriveId],
                };
                const folder = await google_drive_1.drive.files.create({
                    requestBody: folderMetadata,
                    fields: "id",
                    supportsAllDrives: true,
                });
                userFolderId = folder.data.id;
                console.log(`✅ Pasta do utilizador criada: ${userId}`);
            }
            this.userFolderCache.set(userId, userFolderId);
            return userFolderId;
        }
        catch (error) {
            console.error("❌ Erro ao garantir pasta do utilizador:", error.message);
            throw new Error(`Falha ao criar/encontrar pasta do utilizador: ${error.message}`);
        }
    }
    async uploadPhoto(file, userId) {
        try {
            const userFolderId = await this.ensureUserFolder(userId);
            const bufferStream = new stream_1.Readable();
            bufferStream.push(file.buffer);
            bufferStream.push(null);
            const fileMetadata = {
                name: file.originalname,
                parents: [userFolderId],
            };
            const media = {
                mimeType: file.mimetype,
                body: bufferStream,
            };
            const response = await google_drive_1.drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: "id, name, webViewLink, webContentLink, thumbnailLink",
                supportsAllDrives: true,
            });
            console.log(`✅ Foto enviada para o Shared Drive: ${response.data.name}`);
            await google_drive_1.drive.permissions.create({
                fileId: response.data.id,
                requestBody: {
                    role: "reader",
                    type: "anyone",
                },
                supportsAllDrives: true,
            });
            const directUrl = `https://drive.google.com/uc?export=view&id=${response.data.id}`;
            return {
                id: response.data.id,
                name: response.data.name,
                url: directUrl,
                webViewLink: response.data.webViewLink,
                thumbnailLink: response.data.thumbnailLink,
            };
        }
        catch (error) {
            console.error("❌ Erro ao fazer upload para o Shared Drive:", error.message);
            throw new Error(`Falha no upload da foto: ${error.message}`);
        }
    }
    async listUserPhotos(userId) {
        try {
            const userFolderId = await this.ensureUserFolder(userId);
            const response = await google_drive_1.drive.files.list({
                q: `'${userFolderId}' in parents and trashed=false and mimeType contains 'image/'`,
                fields: "files(id, name, webViewLink, webContentLink, thumbnailLink, createdTime, mimeType)",
                orderBy: "createdTime desc",
                supportsAllDrives: true,
                includeItemsFromAllDrives: true,
            });
            return (response.data.files?.map((file) => ({
                id: file.id,
                name: file.name,
                url: `https://drive.google.com/uc?export=view&id=${file.id}`,
                webViewLink: file.webViewLink,
                thumbnailLink: file.thumbnailLink,
                created_at: file.createdTime,
                mimeType: file.mimeType,
            })) || []);
        }
        catch (error) {
            console.error("❌ Erro ao listar fotos do Shared Drive:", error.message);
            throw new Error(`Falha ao listar fotos: ${error.message}`);
        }
    }
    async deletePhoto(fileId) {
        try {
            await google_drive_1.drive.files.delete({
                fileId: fileId,
                supportsAllDrives: true,
            });
            console.log(`✅ Foto deletada do Shared Drive: ${fileId}`);
            return true;
        }
        catch (error) {
            if (error.code === 404) {
                console.warn(`⚠️ Arquivo já não existe: ${fileId}`);
                return true;
            }
            console.error("❌ Erro ao deletar foto:", error.message);
            throw new Error(`Falha ao deletar foto: ${error.message}`);
        }
    }
    async deletePhotoByUrl(photoUrl) {
        try {
            const match = photoUrl.match(/[?&]id=([^&]+)/);
            if (!match) {
                throw new Error("URL inválida do Google Drive");
            }
            const fileId = match[1];
            return await this.deletePhoto(fileId);
        }
        catch (error) {
            console.error(`❌ Erro ao deletar foto por URL: ${error.message}`);
            throw error;
        }
    }
    async listLibraryPhotos(userId) {
        try {
            const photos = await this.listUserPhotos(userId);
            const grouped = {};
            for (const photo of photos) {
                const date = new Date(photo.created_at || new Date());
                const year = date.getFullYear().toString();
                const month = (date.getMonth() + 1).toString().padStart(2, "0");
                const day = date.getDate().toString().padStart(2, "0");
                if (!grouped[year])
                    grouped[year] = {};
                if (!grouped[year][month])
                    grouped[year][month] = {};
                if (!grouped[year][month][day])
                    grouped[year][month][day] = [];
                grouped[year][month][day].push(photo);
            }
            return grouped;
        }
        catch (error) {
            console.error("❌ Erro ao organizar biblioteca:", error.message);
            throw new Error(`Falha ao organizar fotos da biblioteca: ${error.message}`);
        }
    }
}
exports.GoogleDriveService = GoogleDriveService;
exports.googleDriveService = new GoogleDriveService();
//# sourceMappingURL=google-drive.service.js.map