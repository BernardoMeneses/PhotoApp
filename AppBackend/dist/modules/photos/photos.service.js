"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhotosService = void 0;
const uuid_1 = require("uuid");
const google_drive_service_1 = require("../../services/google-drive.service");
const google_drive_token_service_1 = require("../../services/google-drive-token.service");
class PhotosService {
    async uploadPhoto(file) {
        throw new Error("Use uploadPhotosWithUser method instead");
    }
    async uploadPhotosWithUser(files, userId) {
        const uploadedPhotos = [];
        console.log(`📤 Fazendo upload de ${files.length} foto(s) para Google Drive do usuário ${userId}`);
        const hasGoogleDriveTokens = await google_drive_token_service_1.GoogleDriveTokenService.hasTokens(userId);
        if (!hasGoogleDriveTokens) {
            throw new Error("Google Drive não conectado. Por favor, conecte seu Google Drive primeiro.");
        }
        const tokens = await google_drive_token_service_1.GoogleDriveTokenService.loadTokens(userId);
        if (!tokens) {
            throw new Error("Falha ao carregar tokens do Google Drive");
        }
        for (const file of files) {
            const fileName = `${(0, uuid_1.v4)()}-${file.originalname}`;
            try {
                const driveFile = await google_drive_service_1.googleDriveService.uploadPhoto(tokens, fileName, file.buffer, file.mimetype);
                uploadedPhotos.push({
                    id: driveFile.id,
                    name: fileName,
                    url: `https://lh3.googleusercontent.com/d/${driveFile.id}=w1000-h1000`,
                    thumbnailUrl: `https://lh3.googleusercontent.com/d/${driveFile.id}=w300-h300`,
                    fullUrl: `https://drive.google.com/uc?id=${driveFile.id}&export=download`,
                    driveId: driveFile.id,
                    source: 'google-drive'
                });
                console.log(`✅ Foto ${fileName} uploaded para Google Drive`);
            }
            catch (error) {
                console.error(`❌ Erro ao fazer upload de ${fileName}:`, error.message);
                throw new Error(`Falha ao fazer upload de ${fileName}: ${error.message}`);
            }
        }
        console.log(`🎉 ${uploadedPhotos.length} foto(s) uploaded com sucesso para Google Drive`);
        return uploadedPhotos;
    }
    async listAllPhotos() {
        throw new Error("Use listUserPhotos method with userId instead");
    }
    async listUserPhotos(userId) {
        console.log(`📋 Buscando fotos do Google Drive para usuário ${userId}`);
        const hasGoogleDriveTokens = await google_drive_token_service_1.GoogleDriveTokenService.hasTokens(userId);
        if (!hasGoogleDriveTokens) {
            throw new Error("Google Drive não conectado. Por favor, conecte seu Google Drive primeiro.");
        }
        try {
            const tokens = await google_drive_token_service_1.GoogleDriveTokenService.loadTokens(userId);
            if (!tokens) {
                throw new Error("Falha ao carregar tokens do Google Drive");
            }
            const drivePhotos = await google_drive_service_1.googleDriveService.listPhotos(tokens);
            const formattedDrivePhotos = drivePhotos.map(photo => ({
                id: photo.id,
                name: photo.name,
                url: `https://lh3.googleusercontent.com/d/${photo.id}=w1000-h1000`,
                thumbnailUrl: `https://lh3.googleusercontent.com/d/${photo.id}=w300-h300`,
                fullUrl: `https://drive.google.com/uc?id=${photo.id}&export=download`,
                driveId: photo.id,
                source: 'google-drive',
                createdTime: photo.createdTime,
                size: photo.size
            }));
            console.log(`📋 Encontradas ${formattedDrivePhotos.length} fotos no Google Drive`);
            return formattedDrivePhotos;
        }
        catch (error) {
            console.error('❌ Erro ao buscar fotos do Google Drive:', error.message);
            throw new Error(`Falha ao buscar fotos: ${error.message}`);
        }
    }
    async deleteUserPhoto(photoId, userId) {
        console.log(`🗑️ Deletando foto ${photoId} do Google Drive do usuário ${userId}`);
        const hasGoogleDriveTokens = await google_drive_token_service_1.GoogleDriveTokenService.hasTokens(userId);
        if (!hasGoogleDriveTokens) {
            throw new Error("Google Drive não conectado. Por favor, conecte seu Google Drive primeiro.");
        }
        try {
            const tokens = await google_drive_token_service_1.GoogleDriveTokenService.loadTokens(userId);
            if (!tokens) {
                throw new Error("Falha ao carregar tokens do Google Drive");
            }
            const deleted = await google_drive_service_1.googleDriveService.deletePhoto(tokens, photoId);
            if (deleted) {
                console.log(`✅ Foto ${photoId} deletada com sucesso do Google Drive`);
                return true;
            }
            else {
                console.warn(`⚠️ Foto ${photoId} não encontrada no Google Drive`);
                return false;
            }
        }
        catch (error) {
            console.error('❌ Erro ao deletar foto do Google Drive:', error.message);
            throw new Error(`Falha ao deletar foto: ${error.message}`);
        }
    }
    async deletePhotoByUrl(photoUrl, userId) {
        try {
            const match = photoUrl.match(/id=([^&]+)/);
            if (!match) {
                throw new Error("URL inválida do Google Drive");
            }
            const fileId = match[1];
            return await this.deleteUserPhoto(fileId, userId);
        }
        catch (error) {
            console.error(`❌ Erro ao deletar foto por URL: ${error.message}`);
            throw error;
        }
    }
    async listLibraryPhotos(userId) {
        console.log(`📚 Organizando biblioteca de fotos do Google Drive para usuário ${userId}`);
        const photos = await this.listUserPhotos(userId);
        const grouped = {};
        for (const photo of photos) {
            const date = new Date(photo.createdTime || new Date());
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
    async batchDeletePhotos(photoIdentifiers, userId) {
        console.log(`🗑️ Deletando ${photoIdentifiers.length} fotos em lote do Google Drive`);
        const hasGoogleDriveTokens = await google_drive_token_service_1.GoogleDriveTokenService.hasTokens(userId);
        if (!hasGoogleDriveTokens) {
            throw new Error("Google Drive não conectado. Por favor, conecte seu Google Drive primeiro.");
        }
        const tokens = await google_drive_token_service_1.GoogleDriveTokenService.loadTokens(userId);
        if (!tokens) {
            throw new Error("Falha ao carregar tokens do Google Drive");
        }
        try {
            const userPhotos = await google_drive_service_1.googleDriveService.listPhotos(tokens);
            const photoMap = new Map();
            for (const photo of userPhotos) {
                photoMap.set(photo.name, photo.id);
            }
            console.log(`📋 Mapeadas ${photoMap.size} fotos do usuário`);
            const photoIds = [];
            const notFound = [];
            for (const identifier of photoIdentifiers) {
                if (identifier.match(/^[a-zA-Z0-9_-]+$/)) {
                    const foundById = userPhotos.find(photo => photo.id === identifier);
                    if (foundById) {
                        photoIds.push(identifier);
                        continue;
                    }
                }
                const photoId = photoMap.get(identifier);
                if (photoId) {
                    photoIds.push(photoId);
                }
                else {
                    console.warn(`⚠️ Foto não encontrada: ${identifier}`);
                    notFound.push(identifier);
                }
            }
            console.log(`🎯 Encontrados ${photoIds.length} IDs válidos para deletar`);
            console.log(`❌ ${notFound.length} fotos não encontradas`);
            const result = await google_drive_service_1.googleDriveService.batchDeletePhotos(tokens, photoIds);
            result.failed.push(...notFound);
            console.log(`✅ ${result.success.length} fotos deletadas com sucesso`);
            console.log(`❌ ${result.failed.length} fotos falharam`);
            return result;
        }
        catch (error) {
            console.error('❌ Erro no batch delete:', error.message);
            const results = {
                success: [],
                failed: []
            };
            for (const identifier of photoIdentifiers) {
                try {
                    let deleted = false;
                    if (identifier.match(/^[a-zA-Z0-9_-]+$/)) {
                        try {
                            deleted = await this.deleteUserPhoto(identifier, userId);
                        }
                        catch (error) {
                            deleted = false;
                        }
                    }
                    if (!deleted) {
                        try {
                            const userPhotos = await google_drive_service_1.googleDriveService.listPhotos(tokens);
                            const photo = userPhotos.find(p => p.name === identifier);
                            if (photo) {
                                deleted = await this.deleteUserPhoto(photo.id, userId);
                            }
                        }
                        catch (error) {
                            console.error(`❌ Erro ao buscar foto por nome ${identifier}:`, error);
                        }
                    }
                    if (deleted) {
                        results.success.push(identifier);
                    }
                    else {
                        results.failed.push(identifier);
                    }
                }
                catch (error) {
                    console.error(`❌ Falha ao deletar ${identifier}:`, error);
                    results.failed.push(identifier);
                }
            }
            return results;
        }
    }
}
exports.PhotosService = PhotosService;
//# sourceMappingURL=photos.service.js.map