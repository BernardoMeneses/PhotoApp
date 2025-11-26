"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhotosService = void 0;
const uuid_1 = require("uuid");
const google_drive_service_1 = require("../../services/google-drive.service");
const google_drive_token_service_1 = require("../../services/google-drive-token.service");
const database_1 = require("../../config/database");
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
                await this.savePhotoMetadata(userId, driveFile.id, fileName, `https://lh3.googleusercontent.com/d/${driveFile.id}=w1000-h1000`, 'unsorted');
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
    async savePhotoMetadata(userId, photoId, photoName, photoUrl, status = 'unsorted') {
        const client = await database_1.pool.connect();
        try {
            await client.query(`
        INSERT INTO photo_metadata (user_id, photo_id, photo_name, photo_url, status, created_time)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (user_id, photo_id) 
        DO UPDATE SET 
          photo_name = EXCLUDED.photo_name,
          photo_url = EXCLUDED.photo_url,
          updated_at = NOW()
      `, [userId, photoId, photoName, photoUrl, status]);
            console.log(`💾 Metadados salvos: ${photoName} (status: ${status})`);
        }
        catch (error) {
            console.error('❌ Erro ao salvar metadados:', error.message);
        }
        finally {
            client.release();
        }
    }
    async listUnsortedPhotos(userId) {
        console.log(`📥 Buscando fotos UNSORTED para usuário ${userId}`);
        const client = await database_1.pool.connect();
        try {
            const result = await client.query(`
        SELECT photo_id, photo_name, photo_url, created_time, created_at
        FROM photo_metadata 
        WHERE user_id = $1 AND status = 'unsorted'
        ORDER BY created_at DESC
      `, [userId]);
            const unsortedPhotos = result.rows.map(row => ({
                id: row.photo_id,
                name: row.photo_name,
                url: row.photo_url,
                thumbnailUrl: `https://lh3.googleusercontent.com/d/${row.photo_id}=w300-h300`,
                fullUrl: `https://drive.google.com/uc?id=${row.photo_id}&export=download`,
                driveId: row.photo_id,
                source: 'google-drive',
                createdTime: row.created_time,
                uploadedAt: row.created_at,
                status: 'unsorted'
            }));
            console.log(`📥 Encontradas ${unsortedPhotos.length} fotos unsorted`);
            return unsortedPhotos;
        }
        catch (error) {
            console.error('❌ Erro ao buscar fotos unsorted:', error.message);
            throw new Error(`Falha ao buscar fotos unsorted: ${error.message}`);
        }
        finally {
            client.release();
        }
    }
    async listLibraryPhotos(userId) {
        console.log(`📚 Organizando biblioteca de fotos para usuário ${userId}`);
        const client = await database_1.pool.connect();
        try {
            const result = await client.query(`
        SELECT photo_id, photo_name, photo_url, created_time, moved_to_library_at
        FROM photo_metadata 
        WHERE user_id = $1 AND status = 'library'
        ORDER BY created_time DESC
      `, [userId]);
            const libraryPhotos = result.rows.map(row => ({
                id: row.photo_id,
                name: row.photo_name,
                url: row.photo_url,
                thumbnailUrl: `https://lh3.googleusercontent.com/d/${row.photo_id}=w300-h300`,
                fullUrl: `https://drive.google.com/uc?id=${row.photo_id}&export=download`,
                driveId: row.photo_id,
                source: 'google-drive',
                createdTime: row.created_time,
                movedToLibraryAt: row.moved_to_library_at,
                status: 'library'
            }));
            const grouped = {};
            for (const photo of libraryPhotos) {
                const date = new Date(photo.createdTime || photo.movedToLibraryAt);
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
            console.log(`📚 Biblioteca organizada: ${libraryPhotos.length} fotos em ${Object.keys(grouped).length} anos`);
            return grouped;
        }
        catch (error) {
            console.error('❌ Erro ao buscar biblioteca:', error.message);
            throw new Error(`Falha ao buscar biblioteca: ${error.message}`);
        }
        finally {
            client.release();
        }
    }
    async movePhotosToLibrary(userId, photoIds) {
        console.log(`📚 Movendo ${photoIds.length} fotos para Library`);
        const client = await database_1.pool.connect();
        try {
            await client.query('BEGIN');
            for (const photoId of photoIds) {
                await client.query(`
          UPDATE photo_metadata 
          SET status = 'library', moved_to_library_at = NOW(), updated_at = NOW()
          WHERE user_id = $1 AND photo_id = $2 AND status = 'unsorted'
        `, [userId, photoId]);
            }
            await client.query('COMMIT');
            console.log(`✅ ${photoIds.length} fotos movidas para Library`);
            return { success: true, moved: photoIds.length };
        }
        catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Erro ao mover fotos para Library:', error.message);
            throw new Error(`Falha ao mover fotos: ${error.message}`);
        }
        finally {
            client.release();
        }
    }
    async movePhotosToUnsorted(userId, photoIds) {
        console.log(`🔄 Movendo ${photoIds.length} fotos de volta para UNSORTED para usuário ${userId}`);
        const client = await database_1.pool.connect();
        try {
            await client.query('BEGIN');
            for (const photoId of photoIds) {
                await client.query(`
          UPDATE photo_metadata 
          SET status = 'unsorted', moved_to_library_at = NULL, updated_at = NOW()
          WHERE user_id = $1 AND (photo_id = $2 OR photo_name = $2) AND status IN ('library', 'album')
        `, [userId, photoId]);
                console.log(`🔄 Foto ${photoId} movida de volta para unsorted`);
            }
            await client.query('COMMIT');
            console.log(`✅ ${photoIds.length} fotos movidas de volta para UNSORTED`);
            return { success: true, moved: photoIds.length };
        }
        catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Erro ao mover fotos para UNSORTED:', error.message);
            throw new Error(`Falha ao mover fotos para unsorted: ${error.message}`);
        }
        finally {
            client.release();
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
                const client = await database_1.pool.connect();
                try {
                    await client.query(`
            DELETE FROM photo_metadata 
            WHERE user_id = $1 AND (photo_id = $2 OR photo_name = $2)
          `, [userId, photoId]);
                    console.log(`🗑️ Foto ${photoId} removida da base de dados`);
                }
                catch (dbError) {
                    console.error('❌ Erro ao remover foto da base de dados:', dbError.message);
                }
                finally {
                    client.release();
                }
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
            if (result.success.length > 0) {
                const client = await database_1.pool.connect();
                try {
                    await client.query('BEGIN');
                    for (const deletedPhotoId of result.success) {
                        await client.query(`
              DELETE FROM photo_metadata 
              WHERE user_id = $1 AND (photo_id = $2 OR photo_name = $2)
            `, [userId, deletedPhotoId]);
                        console.log(`🗑️ Removida foto ${deletedPhotoId} da base de dados`);
                    }
                    await client.query('COMMIT');
                    console.log(`✅ ${result.success.length} fotos removidas da base de dados`);
                }
                catch (dbError) {
                    await client.query('ROLLBACK');
                    console.error('❌ Erro ao remover fotos da base de dados:', dbError.message);
                }
                finally {
                    client.release();
                }
            }
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