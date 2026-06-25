import { NextResponse } from "next/server";
import { IRIEngine } from "@/lib/iri/iriEngine";

export const runtime = "nodejs";
export const maxDuration = 60; // 60 seconds max duration for complex calculations

/**
 * POST /api/iri/calculate
 *
 * Evaluates the Flood Risk Index (IRI) for a grid generated within a given bounding box.
 *
 * Input JSON:
 * {
 *   "bbox": [minLat, minLon, maxLat, maxLon],
 *   "resolution": 100 | 250 | 500
 * }
 */
export async function POST(req: Request) {
  try {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid JSON payload in request body." },
        { status: 400 }
      );
    }

    const { bbox, resolution } = body;

    // 1. Validation of bounding box (bbox)
    if (!bbox || !Array.isArray(bbox) || bbox.length !== 4) {
      return NextResponse.json(
        {
          error: "Missing or invalid 'bbox'. It must be an array of [minLat, minLng, maxLat, maxLng].",
        },
        { status: 400 }
      );
    }

    const [minLat, minLng, maxLat, maxLng] = bbox.map(Number);
    if (
      isNaN(minLat) ||
      isNaN(minLng) ||
      isNaN(maxLat) ||
      isNaN(maxLng) ||
      minLat >= maxLat ||
      minLng >= maxLng
    ) {
      return NextResponse.json(
        {
          error: "Invalid coordinates in 'bbox'. Ensure minLat < maxLat and minLng < maxLng.",
        },
        { status: 400 }
      );
    }

    // 2. Validation of resolution
    const allowedResolutions = [100, 250, 500];
    const resValue = Number(resolution);
    if (!resolution || !allowedResolutions.includes(resValue)) {
      return NextResponse.json(
        {
          error: `Invalid 'resolution'. Allowed values are: ${allowedResolutions.join(", ")} meters.`,
        },
        { status: 400 }
      );
    }

    // 3. Segment Bounding Box into GeoCells
    const engine = new IRIEngine();
    const cells = engine.segmentBBox([minLat, minLng, maxLat, maxLng], resValue);

    if (cells.length === 0) {
      return NextResponse.json(
        {
          error: "The bounding box area is too small to generate any cells for this resolution.",
        },
        { status: 400 }
      );
    }

    // 4. Performance Guardrail: Prevent processing too many cells (limit to 150)
    const MAX_CELL_LIMIT = 150;
    if (cells.length > MAX_CELL_LIMIT) {
      return NextResponse.json(
        {
          error: `Safety threshold exceeded. The requested bounding box generates ${cells.length} cells, which exceeds the limit of ${MAX_CELL_LIMIT} cells per batch. Please narrow your bounding box or use a larger resolution (e.g., 250m or 500m).`,
        },
        { status: 400 }
      );
    }

    // 5. Calculate Grid IRI Deterministically
    console.log(
      `[API_IRI] Starting calculation for ${cells.length} cells in BBOX [${minLat}, ${minLng}, ${maxLat}, ${maxLng}] at ${resValue}m resolution.`
    );
    const start = Date.now();
    const results = await engine.calculateGridIRI(cells);
    const duration = Date.now() - start;
    console.log(
      `[API_IRI] Finished calculation of ${cells.length} cells. Duration: ${duration}ms.`
    );

    // 6. Return response
    return NextResponse.json({
      cells: results,
    });
  } catch (error: any) {
    console.error("[API_IRI_ERROR] Unexpected error in IRI calculate API:", error);
    return NextResponse.json(
      {
        error: "An unexpected internal server error occurred while calculating the IRI.",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
