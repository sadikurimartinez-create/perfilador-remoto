import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FirebaseBridgeError, issueInstitutionalFirebaseToken } from "@/services/institutionalFirebaseTokenService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const headers = { "Cache-Control": "no-store", "Pragma": "no-cache" };
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(req.url).origin || req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403, headers });
  }
  try {
    // No request body fields participate in identity or claims.
    const customToken = await issueInstitutionalFirebaseToken(cookies().get("ceipol_session")?.value);
    return NextResponse.json({ customToken }, { headers });
  } catch (error) {
    const status = error instanceof FirebaseBridgeError ? error.status : 503;
    const message = error instanceof FirebaseBridgeError ? error.message : "FIREBASE_BRIDGE_UNAVAILABLE";
    return NextResponse.json({ error: message }, { status, headers });
  }
}
