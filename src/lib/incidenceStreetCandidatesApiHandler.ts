import { NextResponse } from "next/server";
import {
  InegiGaiaStreetCandidateProvider,
  type IncidenceStreetCandidateLookupResult,
} from "@/lib/incidenceStreetCandidateProvider";

type StreetCandidatesRequestBody = {
  street?: unknown;
  municipality?: unknown;
};

export type StreetCandidatesHandlerDependencies = {
  resolveStreetCandidates?: (
    input: {
      street: string;
      municipality?: string | null;
    }
  ) => Promise<IncidenceStreetCandidateLookupResult>;
};

function normalizedOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

export async function handleStreetCandidatesPost(
  req: Request,
  dependencies: StreetCandidatesHandlerDependencies = {}
): Promise<NextResponse> {
  try {
    const body = (await req.json()) as StreetCandidatesRequestBody;

    const street = normalizedOptionalText(body.street);
    const municipality = normalizedOptionalText(body.municipality);

    if (!street) {
      return NextResponse.json(
        {
          success: false,
          error: "STREET_REQUIRED",
        },
        { status: 400 }
      );
    }

    const provider = new InegiGaiaStreetCandidateProvider();

    const resolveStreetCandidates =
      dependencies.resolveStreetCandidates ??
      ((input) => provider.resolveStreetCandidates(input));

    const result = await resolveStreetCandidates({
      street,
      municipality,
    });

    return NextResponse.json(
      {
        success: true,
        resolution: result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[api/incidencia/street-candidates] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "STREET_CANDIDATES_INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}