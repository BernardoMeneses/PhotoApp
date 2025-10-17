import { Storage } from "@google-cloud/storage";
import dotenv from "dotenv";

dotenv.config();

export const gcpStorage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

export const bucket = gcpStorage.bucket(process.env.GCP_BUCKET!);

