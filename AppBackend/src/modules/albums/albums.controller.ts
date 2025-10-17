import { Router, Response } from "express";
import { AlbumsService } from "./albums.service";
import { authMiddleware, AuthenticatedRequest } from "../../middleware/auth.middleware";
import { PhotosService } from "../photos/photos.service";
import express from "express";

const router = Router();

// Adicionar middleware para processar diferentes tipos de conteúdo
router.use(express.json());
router.use(express.text());
router.use(express.urlencoded({ extended: true }));

// Middleware customizado para processar text/plain como JSON
router.use((req, res, next) => {
  if (req.headers['content-type'] === 'text/plain; charset=utf-8' || 
      req.headers['content-type'] === 'text/plain') {
    try {
      if (typeof req.body === 'string') {
        req.body = JSON.parse(req.body);
      }
    } catch (error) {
      console.log('⚠️ Failed to parse text/plain as JSON:', error);
    }
  }
  next();
});

const albumsService = new AlbumsService();
const photosService = new PhotosService();

/**
 * POST /albums - Criar um novo álbum
 * Body: { title: string, hexcolor: string, year: number, coverimage?: string, categoryId?: number }
 * Requer autenticação: Bearer token
 */
router.post("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { title, hexcolor, year, coverimage, categoryId } = req.body;

    // Validações
    if (!title || !hexcolor || !year) {
      return res.status(400).json({ 
        error: "Title, hexcolor, and year are required" 
      });
    }

    if (!/^#[0-9A-F]{6}$/i.test(hexcolor)) {
      return res.status(400).json({ 
        error: "Invalid hex color format. Use #RRGGBB" 
      });
    }

    // Validar categoryId se fornecido (aceitar valores vazios para "sem categoria")
    if (categoryId !== undefined && categoryId !== null && categoryId !== "" && (typeof categoryId !== 'number' || categoryId <= 0)) {
      return res.status(400).json({ 
        error: "Invalid category ID" 
      });
    }

    console.log("📁 Creating album for user:", req.user.uid);
    console.log("📝 Album data:", { title, hexcolor, year, coverimage, categoryId });

    // Se não foi fornecida uma imagem de capa, tentar obter uma foto aleatória do usuário
    let finalCoverImage = coverimage;
    if (!finalCoverImage) {
      try {
        const userPhotos = await photosService.listUserPhotos(req.user.uid);
        if (userPhotos.length > 0) {
          // Escolher uma foto aleatória
          const randomIndex = Math.floor(Math.random() * userPhotos.length);
          finalCoverImage = userPhotos[randomIndex].url;
          console.log("🎲 Using random user photo as cover:", finalCoverImage);
        }
      } catch (photoError) {
        console.log("⚠️ Could not get user photos for cover, using color only");
      }
    }

    const album = await albumsService.createAlbum(
      req.user.uid, 
      req.user.email, // Email do Firebase Auth
      {
        title,
        hexcolor,
        year,
        coverimage: finalCoverImage,
        categoryId: categoryId && categoryId !== "" ? categoryId : undefined
      }
    );

    res.status(201).json({
      message: "Album created successfully",
      data: album
    });

  } catch (error: any) {
    console.error("❌ Create album error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /albums - Listar álbuns do usuário com informações de categoria
 * Requer autenticação: Bearer token
 */
router.get("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    console.log("📋 Getting albums with categories for user:", req.user.uid);

    const albums = await albumsService.getUserAlbumsWithCategories(req.user.uid);

    res.json({
      message: "Albums with categories retrieved successfully",
      data: albums,
      count: albums.length
    });

  } catch (error: any) {
    console.error("❌ Get albums error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /albums/simple - Listar álbuns do usuário sem informações de categoria
 * Requer autenticação: Bearer token
 */
router.get("/simple", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    console.log("📋 Getting simple albums for user:", req.user.uid);

    const albums = await albumsService.getUserAlbums(req.user.uid);

    res.json({
      message: "Albums retrieved successfully",
      data: albums,
      count: albums.length
    });

  } catch (error: any) {
    console.error("❌ Get simple albums error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /albums/:id - Obter um álbum específico
 * Requer autenticação: Bearer token
 */
router.get("/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const albumId = parseInt(req.params.id);
    if (isNaN(albumId)) {
      return res.status(400).json({ error: "Invalid album ID" });
    }

    console.log("📖 Getting album:", albumId, "for user:", req.user.uid);

    const album = await albumsService.getAlbumById(albumId, req.user.uid);

    if (!album) {
      return res.status(404).json({ error: "Album not found" });
    }

    res.json({
      message: "Album retrieved successfully",
      data: album
    });

  } catch (error: any) {
    console.error("❌ Get album error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /albums/:id - Atualizar um álbum
 * Body: { title?: string, hexcolor?: string, year?: number, coverimage?: string, categoryId?: number }
 * Requer autenticação: Bearer token
 */
router.put("/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const albumId = parseInt(req.params.id);
    if (isNaN(albumId)) {
      return res.status(400).json({ error: "Invalid album ID" });
    }

    const { title, hexcolor, coverimage, year, categoryId } = req.body;

    // Validar hex color se fornecido
    if (hexcolor && !/^#[0-9A-F]{6}$/i.test(hexcolor)) {
      return res.status(400).json({ 
        error: "Invalid hex color format. Use #RRGGBB" 
      });
    }

    // Validar categoryId se fornecido (null e string vazia são válidos para remover categoria)
    if (categoryId !== undefined && categoryId !== null && categoryId !== "" && (typeof categoryId !== 'number' || categoryId <= 0)) {
      return res.status(400).json({ 
        error: "Invalid category ID" 
      });
    }

    console.log("✏️ Updating album:", albumId, "for user:", req.user.uid);
    console.log("📝 Update data:", { title, hexcolor, year, coverimage, categoryId });

    const updatedAlbum = await albumsService.updateAlbum(albumId, req.user.uid, {
      title,
      hexcolor,
      year,
      coverimage,
      categoryId: categoryId === "" ? null : categoryId
    });

    if (!updatedAlbum) {
      return res.status(404).json({ error: "Album not found" });
    }

    res.json({
      message: "Album updated successfully",
      data: updatedAlbum
    });

  } catch (error: any) {
    console.error("❌ Update album error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /albums/:id - Deletar um álbum
 * Requer autenticação: Bearer token
 */
router.delete("/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const albumId = parseInt(req.params.id);
    if (isNaN(albumId)) {
      return res.status(400).json({ error: "Invalid album ID" });
    }

    console.log("🗑️ Deleting album:", albumId, "for user:", req.user.uid);

    const deleted = await albumsService.deleteAlbum(albumId, req.user.uid);

    if (!deleted) {
      return res.status(404).json({ error: "Album not found" });
    }

    res.json({
      message: "Album deleted successfully"
    });

  } catch (error: any) {
    console.error("❌ Delete album error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /albums/test - Endpoint de teste
 */
router.get("/test/status", (req: AuthenticatedRequest, res: Response) => {
  res.json({
    message: "Albums module is working!",
    availableEndpoints: [
      "POST /albums - Create album (requires auth)",
      "GET /albums - Get user albums (requires auth)",
      "GET /albums/:id - Get specific album (requires auth)",
      "PUT /albums/:id - Update album (requires auth)",
      "DELETE /albums/:id - Delete album (requires auth)",
      "GET /albums/test/status - Test endpoint"
    ],
    authRequired: "Bearer <firebase_token>"
  });
});

// POST /albums/:id/photos - mover/adicionar foto a álbum
router.post("/:id/photos", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const albumId = parseInt(req.params.id);
    const photoName: string = req.body?.photoName;
    const photoUrl: string = req.body?.photoUrl;

    console.log(`� Adding photo to album ${albumId}: ${photoName}`);

    if (!albumId || !photoName || !photoUrl) {
      return res.status(400).json({ 
        error: "albumId, photoName e photoUrl são obrigatórios"
      });
    }

    const added = await albumsService.addPhotoToAlbum(albumId, req.user.uid, photoName, photoUrl);
    res.json({ message: "Foto adicionada ao álbum", data: added });
  } catch (error: any) {
    console.error("❌ Add photo to album error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /albums/:id/photos/batch - adicionar múltiplas fotos a um álbum
router.post("/:id/photos/batch", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const albumId = parseInt(req.params.id);
    const photos: Array<{ photoName: string; photoUrl: string }> = req.body?.photos;

    if (!albumId || !photos || !Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ 
        error: "albumId and photos array are required. Each photo must have photoName and photoUrl"
      });
    }

    // Validar estrutura de cada foto
    const invalidPhotos = photos.filter((p: any) => !p.photoName || !p.photoUrl);
    if (invalidPhotos.length > 0) {
      return res.status(400).json({
        error: "All photos must have photoName and photoUrl properties"
      });
    }

    console.log(`📦 Batch adding ${photos.length} photos to album ${albumId}`);

    const results = await albumsService.batchAddPhotosToAlbum(albumId, req.user.uid, photos);

    res.json({ 
      message: `Batch add completed. Success: ${results.success.length}, Failed: ${results.failed.length}`,
      success: results.success,
      failed: results.failed
    });
  } catch (error: any) {
    console.error("❌ Batch add photos to album error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /albums/:id/photos - listar fotos do álbum
router.get("/:id/photos", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const albumId = parseInt(req.params.id);
    const photos = await albumsService.getAlbumPhotos(albumId, req.user.uid);
    res.json({ message: "Fotos do álbum", data: photos });
  } catch (error: any) {
    console.error("❌ Get album photos error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /albums/:id/photos/:photoName - remover foto do álbum
router.delete("/:id/photos/:photoName", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const albumId = parseInt(req.params.id);
    const { photoName } = req.params;

    const deleted = await albumsService.removePhotoFromAlbum(albumId, req.user.uid, photoName);
    res.json({ message: deleted ? "Foto removida" : "Foto não encontrada" });
  } catch (error: any) {
    console.error("❌ Remove photo from album error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id/categories", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const albumId = parseInt(req.params.id);
    if (isNaN(albumId)) {
      return res.status(400).json({ error: "Invalid album ID" });
    }

    const data = await albumsService.getAlbumWithCategories(albumId, req.user.uid);
    res.json({ 
      message: "Album categories retrieved successfully",
      data 
    });
  } catch (error: any) {
    console.error("❌ Get album categories error:", error.message);
    res.status(500).json({ error: error.message });
  }
});




export default router;