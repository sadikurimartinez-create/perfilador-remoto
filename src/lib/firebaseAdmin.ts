import "server-only";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const APP_NAME = "institutional-admin";

function adminApp() {
  if (typeof window !== "undefined") throw new Error("FIREBASE_ADMIN_SERVER_ONLY");
  const existing = getApps().find(app => app.name === APP_NAME);
  if (existing) return existing;
  try {
    return initializeApp({
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.GCP_PROJECT_ID || "perfilador-remoto",
    }, APP_NAME);
  } catch {
    throw new Error("FIREBASE_ADMIN_INITIALIZATION_FAILED");
  }
}

export function getInstitutionalAdminAuth() { return getAuth(adminApp()); }
export function getInstitutionalAdminDb() { return getFirestore(adminApp()); }
