import { NextResponse } from "next/server";
import { IRICalibrationEngine } from "@/lib/iri/calibration/iriCalibrationEngine";

export const runtime = "nodejs";
export const maxDuration = 60; // 60s max duration for complete calibration runs

/**
 * POST /api/iri/calibrate
 *
 * Runs the calibration pipeline on historical flood events to validate accuracy,
 * calculate errors, and provide dynamic weight adjustment recommendations.
 *
 * Input JSON (All fields are optional):
 * {
 *   "start_date": "2023-01-01T00:00:00Z",
 *   "end_date": "2024-12-31T23:59:59Z",
 *   "region": [minLat, minLng, maxLat, maxLng]
 * }
 */
export async function POST(req: Request) {
  try {
    let body = {};
    
    // Parse JSON body if provided. Body is fully optional.
    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid JSON payload in request body." },
        { status: 400 }
      );
    }

    const { start_date, end_date, region } = body as {
      start_date?: string;
      end_date?: string;
      region?: any;
    };

    // 1. Validation of optional date parameters
    if (start_date && isNaN(Date.parse(start_date))) {
      return NextResponse.json(
        { error: "Invalid 'start_date'. Must be a valid ISO Date string." },
        { status: 400 }
      );
    }
    if (end_date && isNaN(Date.parse(end_date))) {
      return NextResponse.json(
        { error: "Invalid 'end_date'. Must be a valid ISO Date string." },
        { status: 400 }
      );
    }

    // 2. Validation of optional region (bbox)
    let bbox: [number, number, number, number] | undefined = undefined;
    if (region) {
      if (!Array.isArray(region) || region.length !== 4) {
        return NextResponse.json(
          { error: "Invalid 'region'. Must be a bounding box array of [minLat, minLng, maxLat, maxLng]." },
          { status: 400 }
        );
      }
      
      const parsedBbox = region.map(Number);
      if (parsedBbox.some(isNaN) || parsedBbox[0] >= parsedBbox[2] || parsedBbox[1] >= parsedBbox[3]) {
        return NextResponse.json(
          { error: "Invalid coordinate values in 'region'. Ensure minLat < maxLat and minLng < maxLng." },
          { status: 400 }
        );
      }
      bbox = parsedBbox as [number, number, number, number];
    }

    // 3. Execute Calibration Engine Pipeline
    console.log(
      `[API_CALIBRATE] Running IRI model calibration. Dates: ${start_date || "All"} to ${
        end_date || "All"
      } | Region: ${region ? JSON.stringify(region) : "Global"}`
    );
    
    const calibrationEngine = new IRICalibrationEngine();
    
    try {
      const report = await calibrationEngine.runCalibration(start_date, end_date, bbox);
      
      console.log(
        `[API_CALIBRATE] Calibration finished successfully. Samples: ${report.validation_samples} | Base Acc: ${report.accuracy} | Calibrated Acc: ${report.calibrated_accuracy}`
      );
      
      return NextResponse.json(report);
    } catch (calibrationError: any) {
      return NextResponse.json(
        {
          error: "Calibration pipeline failed.",
          details: calibrationError?.message || String(calibrationError),
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("[API_CALIBRATE_ERROR] Unexpected internal server error:", error);
    return NextResponse.json(
      {
        error: "An unexpected internal server error occurred during calibration.",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
