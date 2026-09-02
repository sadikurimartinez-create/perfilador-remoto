import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/utils/authCrypto";
import { GeointOutboxDispatcher } from "@/services/geoint/geointOutboxDispatcher";

export const dynamic = "force-dynamic";

function resolveOperationalActor() {
  const sessionCookie = cookies().get("ceipol_session");
  const payload = sessionCookie?.value ? verifySession(sessionCookie.value) : null;

  if (!payload?.username) {
    return { ok: false as const, status: 401, error: "No autenticado." };
  }

  if (payload.role !== "SUPER_ADMIN" && payload.role !== "ADMIN") {
    return { ok: false as const, status: 403, error: "Operación restringida a administradores." };
  }

  return {
    ok: true as const,
    actor: {
      username: payload.username,
      role: payload.role,
    },
  };
}

export async function POST() {
  const auth = resolveOperationalActor();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const result = await GeointOutboxDispatcher.dispatchPending();
    return NextResponse.json({
      status: "DISPATCH_COMPLETED",
      actor: auth.actor,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        status: "DISPATCH_FAILED",
        actor: auth.actor,
        error: message,
      },
      { status: 500 }
    );
  }
}
