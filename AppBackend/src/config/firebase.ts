import admin from "firebase-admin";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT!;
const serviceAccount = require(path.resolve(serviceAccountPath));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const firebaseAdmin = admin;

