import { NextRequest, NextResponse } from "next/server";
import {
  handleStreetQueryApi,
  type StreetQueryApiBody,
} from "@/lib/incidenceStreetQueryApiHandler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const body =
      (await request.json()) as StreetQueryApiBody;

    const result =
      await handleStreetQueryApi(body);

    return NextResponse.json(
      result.body,
      {
        status: result.status,
      }
    );
  } catch (error) {
    console.error(
      "STREET_QUERY_API_ERROR",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "STREET_QUERY_INTERNAL_ERROR",
      },
      {
        status: 500,
      }
    );
  }
}