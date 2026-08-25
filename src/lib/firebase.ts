import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAnalytics, type Analytics } from "firebase/analytics";
import { getAuth, type Auth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCX8sRh4Km8FLFz1XI-LtbkhzdfhXeAVpw",
  authDomain: "perfilador-remoto.firebaseapp.com",
  databaseURL: "https://perfilador-remoto-default-rtdb.firebaseio.com",
  projectId: "perfilador-remoto",
  storageBucket: "perfilador-remoto.firebasestorage.app",
  messagingSenderId: "1062636354921",
  appId: "1:1062636354921:web:89ebc4ad940d93015e91f8",
  measurementId: "G-WLKXSYNJJ9"
};

let appInstance: FirebaseApp | undefined;
let dbInstance: Firestore | undefined;
let storageInstance: FirebaseStorage | undefined;
let authInstance: Auth | undefined;
let analyticsInstance: Analytics | null = null;

function initFirebase(): FirebaseApp {
  if (!appInstance) {
    if (!getApps().length) {
      appInstance = initializeApp(firebaseConfig);
    } else {
      appInstance = getApp();
    }
  }
  return appInstance;
}

export function getFirebaseApp(): FirebaseApp {
  return initFirebase();
}

export function getDb(): Firestore {
  if (!dbInstance) {
    const app = initFirebase();
    dbInstance = getFirestore(app);
  }
  return dbInstance;
}

export function getStorageInstance(): FirebaseStorage {
  if (!storageInstance) {
    const app = initFirebase();
    storageInstance = getStorage(app);
  }
  return storageInstance;
}

export function getAuthInstance(): Auth {
  if (!authInstance) {
    const app = initFirebase();
    authInstance = getAuth(app);
  }
  return authInstance;
}

export function getAnalyticsInstance(): Analytics | null {
  if (
    typeof window !== "undefined" &&
    process.env.NODE_ENV === "production" &&
    firebaseConfig.measurementId
  ) {
    if (!analyticsInstance) {
      try {
        const app = initFirebase();
        analyticsInstance = getAnalytics(app);
      } catch (err) {
        console.warn("Analytics no disponible:", err);
      }
    }
    return analyticsInstance;
  }
  return null;
}