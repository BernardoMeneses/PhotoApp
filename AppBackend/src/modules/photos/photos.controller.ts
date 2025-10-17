import { Router, Request, Response } from "express";
import multer from "multer";
import { PhotosService } from "./photos.service";
import { authMiddleware, AuthenticatedRequest } from "../../middleware/auth.middleware";
import { googleDriveService } from "../../services/google-drive.service";
import { GoogleDriveTokenService } from "../../services/google-drive-token.service";

const router = Router();
const photosService = new PhotosService();

// Configuração do multer para múltiplos arquivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB por arquivo
    files: 100 // Máximo de 100 arquivos por vez
  },
  fileFilter: (req, file, cb) => {
    // Aceitar apenas imagens
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Upload de múltiplas fotos (requer autenticação)
router.post(
  "/upload",
  authMiddleware,
  upload.array('photos', 10), // 'photos' é o nome do campo, 10 é o máximo
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      console.log(`📤 Uploading ${files.length} photo(s) for user: ${req.user.uid}`);

      const uploadedPhotos = await photosService.uploadPhotosWithUser(
        files,
        req.user.uid
      );

      console.log(`✅ Successfully uploaded ${uploadedPhotos.length} photo(s)`);

      res.status(200).json({
        message: `Successfully uploaded ${uploadedPhotos.length} photo(s)`,
        photos: uploadedPhotos
      });
    } catch (error: any) {
      console.error("❌ Upload error:", error.message);
      res.status(500).json({ error: "Failed to upload photos: " + error.message });
    }
  }
);

// Listar fotos do usuário (requer autenticação)
router.get("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const photos = await photosService.listUserPhotos(req.user.uid);
    res.status(200).json(photos);
  } catch (error: any) {
    console.error("Error listing photos:", error.message);
    res.status(500).json({ error: "Failed to list photos" });
  }
});


// Listar todas as fotos (público)
router.get("/all", async (req: Request, res: Response) => {
  try {
    const photos = await photosService.listAllPhotos();
    res.status(200).json(photos);
  } catch (error: any) {
    console.error("Error listing all photos:", error.message);
    res.status(500).json({ error: "Failed to list photos" });
  }
});

// Deletar foto por nome (requer autenticação)
router.delete("/:photoName", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { photoName } = req.params;
    const success = await photosService.deleteUserPhoto(photoName, req.user.uid);

    if (success) {
      res.status(200).json({ message: "Photo deleted successfully" });
    } else {
      res.status(404).json({ error: "Photo not found" });
    }
  } catch (error: any) {
    console.error("Delete photo error:", error.message);
    res.status(500).json({ error: "Failed to delete photo" });
  }
});

// Deletar foto por URL (requer autenticação)
router.delete("/by-url", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const photoUrl: string = req.body?.photoUrl;
    
    if (!photoUrl) {
      return res.status(400).json({ error: "photoUrl is required" });
    }

    const success = await photosService.deletePhotoByUrl(photoUrl, req.user.uid);

    if (success) {
      res.status(200).json({ message: "Photo deleted successfully" });
    } else {
      res.status(404).json({ error: "Photo not found" });
    }
  } catch (error: any) {
    console.error("Delete photo by URL error:", error.message);
    res.status(500).json({ error: "Failed to delete photo" });
  }
});
// GET /photos/library
router.get("/library", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const grouped = await photosService.listLibraryPhotos(req.user.uid);
    res.json({ message: "Library photos grouped by year", data: grouped });
  } catch (e: any) {
    console.error("❌ Library photos error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /photos/batch-delete - Deletar múltiplas fotos de uma vez
router.post("/batch-delete", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log("📥 Body recebido:", req.body);
    console.log("📥 Body type:", typeof req.body);
    console.log("📥 Body keys:", Object.keys(req.body || {}));

    const photoNames: string[] = req.body?.photoNames;

    console.log("📥 photoNames extraído:", photoNames);
    console.log("📥 photoNames type:", typeof photoNames);
    console.log("📥 photoNames isArray:", Array.isArray(photoNames));

    if (!photoNames || !Array.isArray(photoNames) || photoNames.length === 0) {
      return res.status(400).json({ error: "photoNames array is required and must not be empty" });
    }

    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    console.log(`🗑️ Batch deleting ${photoNames.length} photos for user ${req.user.uid}`);
    
    const results = await photosService.batchDeletePhotos(photoNames, req.user.uid);

    res.status(200).json({
      message: `Batch delete completed. Success: ${results.success.length}, Failed: ${results.failed.length}`,
      success: results.success,
      failed: results.failed
    });
  } catch (err: any) {
    console.error("❌ Erro ao eliminar múltiplas fotos:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ========== GOOGLE DRIVE ENDPOINTS ==========

// POST /photos/connect-drive - Conectar Google Drive
router.post("/connect-drive", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Gerar URL de autenticação do Google
    const authUrl = googleDriveService.getAuthUrl();
    
    res.status(200).json({
      message: "Google Drive authentication URL generated",
      authUrl: authUrl
    });
  } catch (error: any) {
    console.error("❌ Error generating Google Drive auth URL:", error.message);
    res.status(500).json({ error: "Failed to generate auth URL" });
  }
});

// POST /photos/drive-callback - Callback do Google OAuth
router.post("/drive-callback", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: "Authorization code is required" });
    }

    // Trocar código por tokens
    const tokens = await googleDriveService.exchangeCodeForTokens(code);
    
    // Salvar tokens no banco de dados
    await GoogleDriveTokenService.saveTokens(req.user.uid, tokens);
    
    res.status(200).json({
      message: "Google Drive connected successfully",
      connected: true
    });
  } catch (error: any) {
    console.error("❌ Error connecting Google Drive:", error.message);
    res.status(500).json({ error: "Failed to connect Google Drive: " + error.message });
  }
});

// GET /photos/drive-status - Verificar status da conexão com Google Drive
router.get("/drive-status", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const hasTokens = await GoogleDriveTokenService.hasTokens(req.user.uid);
    
    if (hasTokens) {
      const tokens = await GoogleDriveTokenService.loadTokens(req.user.uid);
      const isValid = tokens ? await googleDriveService.validateTokens(tokens) : false;
      
      res.status(200).json({
        connected: true,
        valid: isValid
      });
    } else {
      res.status(200).json({
        connected: false,
        valid: false
      });
    }
  } catch (error: any) {
    console.error("❌ Error checking Google Drive status:", error.message);
    res.status(500).json({ error: "Failed to check Google Drive status" });
  }
});

// DELETE /photos/disconnect-drive - Desconectar Google Drive
router.delete("/disconnect-drive", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Remover tokens do banco de dados
    await GoogleDriveTokenService.deleteTokens(req.user.uid);
    
    res.status(200).json({
      message: "Google Drive disconnected successfully",
      connected: false
    });
  } catch (error: any) {
    console.error("❌ Error disconnecting Google Drive:", error.message);
    res.status(500).json({ error: "Failed to disconnect Google Drive" });
  }
});

export default router;







