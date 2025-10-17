import { v4 as uuidv4 } from "uuid";
import { googleDriveService } from "../../services/google-drive.service";
import { GoogleDriveTokenService } from "../../services/google-drive-token.service";

export class PhotosService {
  // Upload para Google Drive (método principal)
  async uploadPhoto(file: Express.Multer.File) {
    throw new Error("Use uploadPhotosWithUser method instead");
  }

  // Upload com userId para múltiplas fotos - APENAS GOOGLE DRIVE
  async uploadPhotosWithUser(files: Express.Multer.File[], userId: string) {
    const uploadedPhotos = [];

    console.log(`📤 Fazendo upload de ${files.length} foto(s) para Google Drive do usuário ${userId}`);

    // Verificar se o usuário tem tokens do Google Drive
    const hasGoogleDriveTokens = await GoogleDriveTokenService.hasTokens(userId);
    
    if (!hasGoogleDriveTokens) {
      throw new Error("Google Drive não conectado. Por favor, conecte seu Google Drive primeiro.");
    }

    const tokens = await GoogleDriveTokenService.loadTokens(userId);
    if (!tokens) {
      throw new Error("Falha ao carregar tokens do Google Drive");
    }

    // Upload para Google Drive
    for (const file of files) {
      const fileName = `${uuidv4()}-${file.originalname}`;
      
      try {
        const driveFile = await googleDriveService.uploadPhoto(
          tokens,
          fileName,
          file.buffer,
          file.mimetype
        );

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
      } catch (error: any) {
        console.error(`❌ Erro ao fazer upload de ${fileName}:`, error.message);
        throw new Error(`Falha ao fazer upload de ${fileName}: ${error.message}`);
      }
    }

    console.log(`🎉 ${uploadedPhotos.length} foto(s) uploaded com sucesso para Google Drive`);
    return uploadedPhotos;
  }

  // Lista todas as fotos (agora apenas do Google Drive)
  async listAllPhotos() {
    throw new Error("Use listUserPhotos method with userId instead");
  }

  // Lista fotos de um usuário específico - APENAS GOOGLE DRIVE
  async listUserPhotos(userId: string) {
    console.log(`📋 Buscando fotos do Google Drive para usuário ${userId}`);

    // Verificar se o usuário tem tokens do Google Drive
    const hasGoogleDriveTokens = await GoogleDriveTokenService.hasTokens(userId);
    
    if (!hasGoogleDriveTokens) {
      throw new Error("Google Drive não conectado. Por favor, conecte seu Google Drive primeiro.");
    }

    try {
      const tokens = await GoogleDriveTokenService.loadTokens(userId);
      if (!tokens) {
        throw new Error("Falha ao carregar tokens do Google Drive");
      }

      const drivePhotos = await googleDriveService.listPhotos(tokens);
      
      // Converter formato do Google Drive para o formato esperado
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

    } catch (error: any) {
      console.error('❌ Erro ao buscar fotos do Google Drive:', error.message);
      throw new Error(`Falha ao buscar fotos: ${error.message}`);
    }
  }

  // Deletar uma foto específica de um usuário - APENAS GOOGLE DRIVE
  async deleteUserPhoto(photoId: string, userId: string): Promise<boolean> {
    console.log(`🗑️ Deletando foto ${photoId} do Google Drive do usuário ${userId}`);

    // Verificar se o usuário tem tokens do Google Drive
    const hasGoogleDriveTokens = await GoogleDriveTokenService.hasTokens(userId);
    
    if (!hasGoogleDriveTokens) {
      throw new Error("Google Drive não conectado. Por favor, conecte seu Google Drive primeiro.");
    }

    try {
      const tokens = await GoogleDriveTokenService.loadTokens(userId);
      if (!tokens) {
        throw new Error("Falha ao carregar tokens do Google Drive");
      }

      const deleted = await googleDriveService.deletePhoto(tokens, photoId);
      
      if (deleted) {
        console.log(`✅ Foto ${photoId} deletada com sucesso do Google Drive`);
        return true;
      } else {
        console.warn(`⚠️ Foto ${photoId} não encontrada no Google Drive`);
        return false;
      }

    } catch (error: any) {
      console.error('❌ Erro ao deletar foto do Google Drive:', error.message);
      throw new Error(`Falha ao deletar foto: ${error.message}`);
    }
  }

  // Deletar foto por URL (extrair ID do arquivo da URL do Google Drive)
  async deletePhotoByUrl(photoUrl: string, userId: string): Promise<boolean> {
    try {
      // Extrair o ID do arquivo da URL do Google Drive
      // URL formato: https://drive.google.com/uc?id=FILE_ID&export=download
      const match = photoUrl.match(/id=([^&]+)/);
      if (!match) {
        throw new Error("URL inválida do Google Drive");
      }
      
      const fileId = match[1];
      return await this.deleteUserPhoto(fileId, userId);
      
    } catch (error: any) {
      console.error(`❌ Erro ao deletar foto por URL: ${error.message}`);
      throw error;
    }
  }

  // Lista fotos do usuário organizadas por data (biblioteca) - APENAS GOOGLE DRIVE
  async listLibraryPhotos(userId: string) {
    console.log(`📚 Organizando biblioteca de fotos do Google Drive para usuário ${userId}`);

    const photos = await this.listUserPhotos(userId);

    // Agrupamento por ano/mês/dia
    const grouped: Record<string, Record<string, Record<string, any[]>>> = {};

    for (const photo of photos) {
      const date = new Date(photo.createdTime || new Date());

      const year = date.getFullYear().toString();
      const month = (date.getMonth() + 1).toString().padStart(2, "0"); // 01–12
      const day = date.getDate().toString().padStart(2, "0"); // 01–31

      if (!grouped[year]) grouped[year] = {};
      if (!grouped[year][month]) grouped[year][month] = {};
      if (!grouped[year][month][day]) grouped[year][month][day] = [];

      grouped[year][month][day].push(photo);
    }

    return grouped;
  }

  // Deletar múltiplas fotos de uma vez - APENAS GOOGLE DRIVE
  async batchDeletePhotos(photoIdentifiers: string[], userId: string): Promise<{ success: string[], failed: string[] }> {
    console.log(`🗑️ Deletando ${photoIdentifiers.length} fotos em lote do Google Drive`);

    // Verificar se o usuário tem tokens do Google Drive
    const hasGoogleDriveTokens = await GoogleDriveTokenService.hasTokens(userId);
    
    if (!hasGoogleDriveTokens) {
      throw new Error("Google Drive não conectado. Por favor, conecte seu Google Drive primeiro.");
    }

    const tokens = await GoogleDriveTokenService.loadTokens(userId);
    if (!tokens) {
      throw new Error("Falha ao carregar tokens do Google Drive");
    }

    try {
      // Primeiro, listar todas as fotos do usuário para mapear nomes para IDs
      const userPhotos = await googleDriveService.listPhotos(tokens);
      const photoMap = new Map<string, string>(); // name -> id
      
      for (const photo of userPhotos) {
        photoMap.set(photo.name, photo.id);
      }

      console.log(`📋 Mapeadas ${photoMap.size} fotos do usuário`);

      // Converter identificadores (nomes ou IDs) para IDs válidos
      const photoIds: string[] = [];
      const notFound: string[] = [];

      for (const identifier of photoIdentifiers) {
        // Verificar se é um ID direto (Google Drive IDs são alphanumeric com hífens/underscores)
        if (identifier.match(/^[a-zA-Z0-9_-]+$/)) {
          // Pode ser um ID, verificar se existe
          const foundById = userPhotos.find(photo => photo.id === identifier);
          if (foundById) {
            photoIds.push(identifier);
            continue;
          }
        }

        // Tentar buscar por nome
        const photoId = photoMap.get(identifier);
        if (photoId) {
          photoIds.push(photoId);
        } else {
          console.warn(`⚠️ Foto não encontrada: ${identifier}`);
          notFound.push(identifier);
        }
      }

      console.log(`🎯 Encontrados ${photoIds.length} IDs válidos para deletar`);
      console.log(`❌ ${notFound.length} fotos não encontradas`);

      const result = await googleDriveService.batchDeletePhotos(tokens, photoIds);
      
      // Adicionar fotos não encontradas aos failed
      result.failed.push(...notFound);
      
      console.log(`✅ ${result.success.length} fotos deletadas com sucesso`);
      console.log(`❌ ${result.failed.length} fotos falharam`);
      
      return result;

    } catch (error: any) {
      console.error('❌ Erro no batch delete:', error.message);
      
      // Fallback: deletar uma por uma usando método individual que já resolve nomes
      const results = {
        success: [] as string[],
        failed: [] as string[]
      };

      for (const identifier of photoIdentifiers) {
        try {
          // Primeiro tentar como ID direto
          let deleted = false;
          if (identifier.match(/^[a-zA-Z0-9_-]+$/)) {
            try {
              deleted = await this.deleteUserPhoto(identifier, userId);
            } catch (error) {
              // Se falhar como ID, tentar como nome
              deleted = false;
            }
          }

          // Se não funcionou como ID, tentar buscar por nome
          if (!deleted) {
            try {
              const userPhotos = await googleDriveService.listPhotos(tokens);
              const photo = userPhotos.find(p => p.name === identifier);
              if (photo) {
                deleted = await this.deleteUserPhoto(photo.id, userId);
              }
            } catch (error) {
              console.error(`❌ Erro ao buscar foto por nome ${identifier}:`, error);
            }
          }

          if (deleted) {
            results.success.push(identifier);
          } else {
            results.failed.push(identifier);
          }
        } catch (error) {
          console.error(`❌ Falha ao deletar ${identifier}:`, error);
          results.failed.push(identifier);
        }
      }

      return results;
    }
  }
}

