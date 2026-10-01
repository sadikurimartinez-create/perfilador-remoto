import "server-only";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const APP_NAME = "institutional-admin";

function adminApp() {
  if (typeof window !== "undefined") throw new Error("FIREBASE_ADMIN_SERVER_ONLY");
  const existing = getApps().find(app => app.name === APP_NAME);
  if (existing) return existing;
  const projectId = process.env.GCP_PROJECT_ID?.trim();
  const clientEmail = process.env.GCP_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GCP_PRIVATE_KEY?.trim();
  const explicitConfigured = [process.env.GCP_PROJECT_ID, process.env.GCP_CLIENT_EMAIL, process.env.GCP_PRIVATE_KEY]
    .some(value => value !== undefined);
  if (explicitConfigured && (!projectId || !clientEmail || !privateKey)) {
    throw new Error("FIREBASE_ADMIN_EXPLICIT_CREDENTIALS_INCOMPLETE");
  }
  try {
    // Vercel's explicit environment credentials are not automatically consumed by ADC.
    // Only normalize the key in memory; never log or persist credential material.
    const credential = explicitConfigured
      ? cert({ projectId, clientEmail, privateKey: privateKey!.replace(/\\n/g, "\n") })
      : applicationDefault();
    return initializeApp({
      credential,
      projectId: projectId || process.env.FIREBASE_ADMIN_PROJECT_ID?.trim() || "perfilador-remoto",
    }, APP_NAME);
  } catch {
    throw new Error("FIREBASE_ADMIN_INITIALIZATION_FAILED");
  }
}

export function getInstitutionalAdminAuth() { return getAuth(adminApp()); }
export function getInstitutionalAdminDb() { return getFirestore(adminApp()); }

/** Temporary server-only diagnostic. Return comparisons, never configuration values. */
export function getFirebaseAdminRuntimeDiagnostic(): {
  adminProjectMatchesExpected: boolean | "unknown";
  credentialProjectMatchesExpected: boolean | "unknown";
  explicitCredentialsMode: boolean;
} {
  const app = adminApp();
  const projectId = app.options?.projectId;
  // cert() exposes clientEmail on its credential; ADC may not expose signer identity.
  // Use the retained credential rather than rereading potentially changed environment values.
  const credential = app.options?.credential as { clientEmail?: unknown } | undefined;
  const email = typeof credential?.clientEmail === "string" ? credential.clientEmail.trim() : "";
  return {
    adminProjectMatchesExpected: projectId ? projectId === "perfilador-remoto" : "unknown",
    credentialProjectMatchesExpected: email
      ? email.endsWith("@perfilador-remoto.iam.gserviceaccount.com") && email.length > "@perfilador-remoto.iam.gserviceaccount.com".length
      : "unknown",
    explicitCredentialsMode: typeof credential?.clientEmail === "string",
  };
}
