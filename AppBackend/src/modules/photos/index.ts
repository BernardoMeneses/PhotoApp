import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

import authRouter from "../auth/auth.controller";
import photosRouter from "./photos.controller";

const app = express();

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// Rota raiz só para teste
app.get("/", (req, res) => {
  res.json({ message: "Backend API online 🚀" });
});

// Autenticação
app.use("/auth", authRouter);

// Fotos
app.use("/photos", photosRouter);

export default app;

