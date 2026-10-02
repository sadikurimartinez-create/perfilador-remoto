"use client";
import { inMemoryPersistence, setPersistence, signInWithCustomToken, signOut } from "firebase/auth";
import { getAuthInstance } from "@/lib/firebase";

let generation = 0;
let queue: Promise<unknown> = Promise.resolve();
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
function stopRefresh() { if (refreshTimer) clearTimeout(refreshTimer); refreshTimer = undefined; }
function scheduleRefresh(current: number) {
  stopRefresh();
  refreshTimer = setTimeout(() => {
    void serialized(async () => {
      if (current !== generation) return;
      const auth = getAuthInstance();
      try {
        const response = await fetch("/api/auth/firebase-token", { method: "POST", credentials: "same-origin", cache: "no-store" });
        if (!response.ok) throw new Error("FIREBASE_AUTHORIZATION_REFRESH_DENIED");
        const data = await response.json();
        if (typeof data.customToken !== "string" || !data.customToken) throw new Error("FIREBASE_BRIDGE_INVALID_RESPONSE");
        if (current !== generation) return;
        await signInWithCustomToken(auth, data.customToken);
        if (current === generation) scheduleRefresh(current);
        else await signOut(auth);
      } catch {
        if (current === generation) { ++generation; stopRefresh(); await signOut(auth); }
      }
    });
  }, 120_000);
  // Browser timers have no unref; test/SSR environments must not be kept alive.
  if (typeof refreshTimer === "object" && "unref" in refreshTimer) refreshTimer.unref();
}

function serialized<T>(action: () => Promise<T>): Promise<T> {
  const next = queue.then(action, action);
  queue = next.catch(() => undefined);
  return next;
}

export function connectInstitutionalFirebase() {
  const current = ++generation;
  stopRefresh();
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
    else scheduleRefresh(current);
  });
}

export function disconnectInstitutionalFirebase() {
  ++generation;
  stopRefresh();
  return serialized(() => signOut(getAuthInstance()));
}
