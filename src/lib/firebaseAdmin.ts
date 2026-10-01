import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const APP_NAME = "institutional-admin";
const EXPECTED_PROJECT_ID = "perfilador-remoto";
const EXPECTED_EMAIL_SUFFIX = `@${EXPECTED_PROJECT_ID}.iam.gserviceaccount.com`;

function matchesCredentialProject(email: string) {
  return email.endsWith(EXPECTED_EMAIL_SUFFIX)
    && email.length > EXPECTED_EMAIL_SUFFIX.length && !/\s|.*@.*@/.test(email);
}

function adminApp() {
  if (typeof window !== "undefined") throw new Error("FIREBASE_ADMIN_SERVER_ONLY");
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.trim();
  const explicitConfigured = [projectId, clientEmail, process.env.FIREBASE_ADMIN_PRIVATE_KEY]
    .some(value => value !== undefined);
  // Dedicated credentials are required in every environment; never infer a signer from ADC/GCP.
  if (!explicitConfigured) throw new Error("FIREBASE_ADMIN_EXPLICIT_CREDENTIALS_REQUIRED");
  if (!projectId?.trim() || !clientEmail?.trim() || !privateKey) {
    throw new Error("FIREBASE_ADMIN_EXPLICIT_CREDENTIALS_INCOMPLETE");
  }
  if (projectId !== EXPECTED_PROJECT_ID) throw new Error("FIREBASE_ADMIN_PROJECT_MISMATCH");
  if (!matchesCredentialProject(clientEmail)) throw new Error("FIREBASE_ADMIN_CREDENTIAL_PROJECT_MISMATCH");
  const existing = getApps().find(app => app.name === APP_NAME);
  if (existing) {
    const retainedCredential = existing.options.credential as { clientEmail?: unknown } | undefined;
    if (existing.options.projectId !== EXPECTED_PROJECT_ID) throw new Error("FIREBASE_ADMIN_PROJECT_MISMATCH");
    if (typeof retainedCredential?.clientEmail !== "string" || !matchesCredentialProject(retainedCredential.clientEmail)) {
      throw new Error("FIREBASE_ADMIN_CREDENTIAL_PROJECT_MISMATCH");
    }
    return existing;
  }
  try {
    // Only normalize the key in memory; never log or persist credential material.
    const credential = cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") });
    return initializeApp({
      credential,
      projectId,
    }, APP_NAME);
  } catch {
    throw new Error("FIREBASE_ADMIN_INITIALIZATION_FAILED");
  }
}

export function getInstitutionalAdminAuth() { return getAuth(adminApp()); }
export function getInstitutionalAdminDb() { return getFirestore(adminApp()); }
