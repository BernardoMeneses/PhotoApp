import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { testConnection } from "./config/database";
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Endpoint de teste básico
app.get("/ping", (req, res) => {
  res.json({ message: "Pong from backend 🚀" });
});

// Servir arquivos estáticos
app.use("/uploads", express.static("uploads"));
app.use("/test", express.static(".", { index: "test-routes.html" }));

// Swagger UI
try {
  const spec = YAML.load('./openapi.yaml');
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));

} catch (err) {
  console.error("❌ Error setting up Swagger UI:", err);
}

// 👉 Importa rotas de módulos
try {
  const photosRouter = require("./modules/photos/photos.controller").default;
  const authRouter = require("./modules/auth/auth.controller").default;
  const profileRouter = require("./modules/profile/profile.controller").default;
  const albumsRouter = require("./modules/albums/albums.controller").default;
  const categoriesRouter = require("./modules/categories/categories.controller").default;

  app.use("/", authRouter);
  app.use("/auth", authRouter);
  app.use("/photos", photosRouter);
  app.use("/profile", profileRouter);
  app.use("/albums", albumsRouter);
  app.use("/categories", categoriesRouter);
  
} catch (error) {
  console.error("❌ Error loading routes:", error);
}

app.listen(PORT, async () => {
  console.log(`✅ Server running`);
  
  // Testar conexão com a base de dados
  try {
    await testConnection();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  }
});