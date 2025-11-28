import { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../../middleware/auth.middleware";
import { googleDriveService } from "../../services/google-drive.service";
import { pool } from "../../config/database";

const router = Router();

// GET /profile/drive-usage - retorna o uso do Google Drive do utilizador autenticado
router.get("/usage", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Buscar tokens do utilizador na base de dados
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const result = await pool.query(
      "SELECT google_drive_access_token, google_drive_refresh_token FROM users WHERE id = $1",
      [userId]
    );
    const row = result.rows[0];
    if (!row || !row.google_drive_access_token) {
      return res.status(400).json({ error: "Google Drive not connected" });
    }
    const tokens = {
      access_token: row.google_drive_access_token,
      refresh_token: row.google_drive_refresh_token,
    };
    // Chamar Google API para obter uso
    const drive = googleDriveService["createDriveClient"](tokens);
    const about = await drive.about.get({ fields: "storageQuota" });
    const quota = about.data.storageQuota;
    res.json({
      used: Number(quota?.usage || 0),
      total: Number(quota?.limit || 15 * 1024 * 1024 * 1024) // fallback 15GB
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get Google Drive usage" });
  }
});

export default router;
