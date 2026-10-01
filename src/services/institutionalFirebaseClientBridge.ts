"use client";
import { inMemoryPersistence, setPersistence, signInWithCustomToken, signOut } from "firebase/auth";
import { getAuthInstance } from "@/lib/firebase";

let generation = 0;
let queue: Promise<unknown> = Promise.resolve();

function serialized<T>(action: () => Promise<T>): Promise<T> {
  const next = queue.then(action, action);
  queue = next.catch(() => undefined);
  return next;
}

export function connectInstitutionalFirebase() {
  const current = ++generation;
  return serialized(async () => {
    const auth = getAuthInstance();
    await signOut(auth);
    if (current !== generation) return;
    await setPersistence(auth, inMemoryPersistence);
    const response = await fetch("/api/auth/firebase-token", { method: "POST", credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error("FIREBASE_BRIDGE_UNAVAILABLE");
    const data = await response.json();
    if (current !== generation) return;
    if (typeof data.customToken !== "string" || !data.customToken) throw new Error("FIREBASE_BRIDGE_INVALID_RESPONSE");
    await signInWithCustomToken(auth, data.customToken);
    if (current !== generation) await signOut(auth);
  });
}

export function disconnectInstitutionalFirebase() {
  ++generation;
  return serialized(() => signOut(getAuthInstance()));
}
