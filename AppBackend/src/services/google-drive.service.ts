import { google } from 'googleapis';
import { Readable } from 'stream';

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
}

export class GoogleDriveService {
  private oauth2Client: any;
  private readonly SCOPES = ['https://www.googleapis.com/auth/drive.file'];

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      process.env.GOOGLE_DRIVE_REDIRECT_URI
    );
  }

  /**
   * Gerar URL de autenticação do Google
   */
  getAuthUrl(): string {
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.SCOPES,
      prompt: 'consent',
      redirect_uri: process.env.GOOGLE_DRIVE_REDIRECT_URI // ✅ manter
    });
    return authUrl;
  }

  /**
   * Criar cliente do Google Drive com tokens do usuário
   */
  private createDriveClient(tokens: GoogleTokens) {
    this.oauth2Client.setCredentials(tokens);
    return google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Trocar authorization code por access_token e refresh_token
   */
  async exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
    const { tokens } = await this.oauth2Client.getToken({
      code,
      redirect_uri: process.env.GOOGLE_DRIVE_REDIRECT_URI // ✅ manter
    });
    return tokens;
  }

  /**
   * Encontrar ou criar pasta do app no Google Drive
   */
  async ensureAppFolder(tokens: GoogleTokens, folderName: string = 'PhotoApp'): Promise<string> {
    const drive = this.createDriveClient(tokens);

    try {
      // Procurar pasta existente
      const query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`;

      const response = await drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive'
      });

      if (response.data.files && response.data.files.length > 0) {
        console.log(`📁 Pasta '${folderName}' encontrada:`, response.data.files[0].id);
        return response.data.files[0].id!;
      }

      // Criar nova pasta
      const folderResponse = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id'
      });

      console.log(`📁 Pasta '${folderName}' criada:`, folderResponse.data.id);
      return folderResponse.data.id!;
    } catch (error: any) {
      console.error('❌ Erro ao criar/encontrar pasta:', error.message);
      throw new Error('Failed to ensure app folder');
    }
  }

  /**
   * Upload de foto para Google Drive
   */
  async uploadPhoto(
    tokens: GoogleTokens,
    fileName: string,
    fileBuffer: Buffer,
    mimeType: string,
    folderId?: string
  ): Promise<{ id: string; name: string; webViewLink: string; webContentLink: string }> {
    const drive = this.createDriveClient(tokens);

    try {
      // Se não foi fornecido folderId, criar/encontrar pasta do app
      if (!folderId) {
        folderId = await this.ensureAppFolder(tokens);
      }

      // Criar stream do buffer
      const media = {
        mimeType: mimeType,
        body: Readable.from(fileBuffer)
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

      const fileId = response.data.id!;

      // Tornar o arquivo público para que a URL de thumbnail funcione
      try {
        await drive.permissions.create({
          fileId: fileId,
          requestBody: {
            role: 'reader',
            type: 'anyone'
          }
        });
        console.log(`🔓 Arquivo ${fileName} tornado público`);
      } catch (permError: any) {
        console.warn(`⚠️ Não foi possível tornar o arquivo público: ${permError.message}`);
      }

      console.log(`📤 Foto '${fileName}' uploaded para Google Drive:`, fileId);

      return {
        id: fileId,
        name: response.data.name!,
        webViewLink: response.data.webViewLink!,
        webContentLink: response.data.webContentLink!
      };
    } catch (error: any) {
      console.error('❌ Erro ao fazer upload para Google Drive:', error.message);
      throw new Error('Failed to upload photo to Google Drive');
    }
  }

  /**
   * Listar fotos do usuário no Google Drive
   */
  async listPhotos(tokens: GoogleTokens, folderId?: string): Promise<Array<{
    id: string;
    name: string;
    webViewLink: string;
    webContentLink: string;
    createdTime: string;
    size: string;
  }>> {
    const drive = this.createDriveClient(tokens);

    try {
      // Se não foi fornecido folderId, usar pasta do app
      if (!folderId) {
        folderId = await this.ensureAppFolder(tokens);
      }

      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`,
        fields: 'files(id, name, webViewLink, webContentLink, createdTime, size)',
        orderBy: 'createdTime desc'
      });

      console.log(`📋 Encontradas ${response.data.files?.length || 0} fotos no Google Drive`);

      const files = response.data.files || [];
      
      // Garantir que todos os arquivos sejam públicos
      for (const file of files) {
        if (file.id) {
          await this.ensureFileIsPublic(tokens, file.id);
        }
      }

      return files.map(file => ({
        id: file.id!,
        name: file.name!,
        // 👇 usa URL do Google User Content que funciona melhor para imagens públicas
        webViewLink: `https://lh3.googleusercontent.com/d/${file.id}=w1000-h1000`,
        webContentLink: file.webContentLink
          ?? `https://drive.google.com/uc?id=${file.id}&export=download`,
        createdTime: file.createdTime!,
        size: file.size!
      }));

    } catch (error: any) {
      console.error('❌ Erro ao listar fotos do Google Drive:', error.message);
      throw new Error('Failed to list photos from Google Drive');
    }
  }

  /**
   * Deletar foto do Google Drive
   */
  async deletePhoto(tokens: GoogleTokens, fileId: string): Promise<boolean> {
    const drive = this.createDriveClient(tokens);

    try {
      await drive.files.delete({
        fileId: fileId
      });

      console.log(`🗑️ Foto deletada do Google Drive:`, fileId);
      return true;
    } catch (error: any) {
      console.error('❌ Erro ao deletar foto do Google Drive:', error.message);
      if (error.code === 404) {
        console.log('📝 Arquivo não encontrado, considerando como deletado');
        return true;
      }
      return false;
    }
  }

  /**
   * Deletar múltiplas fotos do Google Drive
   */
  async batchDeletePhotos(tokens: GoogleTokens, fileIds: string[]): Promise<{
    success: string[];
    failed: string[];
  }> {
    const results = {
      success: [] as string[],
      failed: [] as string[]
    };

    for (const fileId of fileIds) {
      try {
        const deleted = await this.deletePhoto(tokens, fileId);
        if (deleted) {
          results.success.push(fileId);
        } else {
          results.failed.push(fileId);
        }
      } catch (error) {
        console.error(`❌ Falha ao deletar ${fileId}:`, error);
        results.failed.push(fileId);
      }
    }

    return results;
  }

  /**
   * Verificar e tornar arquivo público se necessário
   */
  async ensureFileIsPublic(tokens: GoogleTokens, fileId: string): Promise<boolean> {
    const drive = this.createDriveClient(tokens);

    try {
      // Verificar se já é público
      const permissions = await drive.permissions.list({
        fileId: fileId,
        fields: 'permissions(id,type,role)'
      });

      const isPublic = permissions.data.permissions?.some(
        perm => perm.type === 'anyone' && perm.role === 'reader'
      );

      if (isPublic) {
        console.log(`✅ Arquivo ${fileId} já é público`);
        return true;
      }

      // Tornar público
      await drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });

      console.log(`🔓 Arquivo ${fileId} tornado público`);
      return true;
    } catch (error: any) {
      console.error(`❌ Erro ao tornar arquivo público ${fileId}:`, error.message);
      return false;
    }
  }

  /**
   * Obter URL de download direto da foto
   */
  async getPhotoDownloadUrl(tokens: GoogleTokens, fileId: string): Promise<string> {
    const drive = this.createDriveClient(tokens);

    try {
      const response = await drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, {
        responseType: 'stream'
      });

      // Para fotos, podemos usar webContentLink ou criar uma URL de acesso direto
      return `https://drive.google.com/uc?id=${fileId}&export=download`;
    } catch (error: any) {
      console.error('❌ Erro ao obter URL de download:', error.message);
      throw new Error('Failed to get download URL');
    }
  }

  /**
   * Verificar se tokens ainda são válidos
   */
  async validateTokens(tokens: GoogleTokens): Promise<boolean> {
    try {
      const drive = this.createDriveClient(tokens);
      await drive.files.list({ pageSize: 1 });
      return true;
    } catch (error: any) {
      console.error('❌ Tokens inválidos ou expirados:', error.message);
      return false;
    }
  }

  /**
   * Refresh tokens se necessário
   */
  async refreshTokens(refreshToken: string): Promise<GoogleTokens> {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      console.log('🔄 Tokens refreshed com sucesso');

      return credentials;
    } catch (error: any) {
      console.error('❌ Erro ao refresh tokens:', error.message);
      throw new Error('Failed to refresh tokens');
    }
  }
}

export const googleDriveService = new GoogleDriveService();