"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAnalytics, type Analytics } from "firebase/analytics";
import { getAuth, type Auth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCX8sRh4Km8FLFz1XI-LtbkhzdfhXeAVpw",
  authDomain: "perfilador-remoto.firebaseapp.com",
  databaseURL: "https://perfilador-remoto-default-rtdb.firebaseio.com",
  projectId: "perfilador-remoto",
  storageBucket: "perfilador-remoto.appspot.com",
  messagingSenderId: "1062636354921",
  appId: "1:1062636354921:web:89ebc4ad940d93015e91f8",
  measurementId: "G-WLKXSYNJJ9"
};

let app: FirebaseApp;
let db: Firestore;
let storage: FirebaseStorage;
let analytics: Analytics | null = null;
let auth: Auth;

if (typeof window !== "undefined") {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  db = getFirestore(app);
  storage = getStorage(app);
  auth = getAuth(app);
  if (firebaseConfig.measurementId) {
    analytics = getAnalytics(app);
  }
}

export function getDb(): Firestore {
  return db;
}

export function getFirebaseApp(): FirebaseApp {
  return app;
}

export function getAuthInstance(): Auth {
  return auth;
}

export { app, db, storage, analytics, auth };