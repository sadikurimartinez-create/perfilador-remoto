import { NextResponse } from "next/server";
import { IRIGeneralizationEngine } from "@/lib/iri/validation/iriGeneralizationEngine";

export const runtime = "nodejs";
export const maxDuration = 60; // 60s max execution time for multi-regional validation and stress tests

/**
 * POST /api/iri/generalization-test
 *
 * Runs the geographic generalization validation and stress tests across diverse regions.
 *
 * Input JSON (All fields are optional):
 * {
 *   "regions": ["CDMX", "JAL", "NL", "VER", "TAB", "GLOBAL"],
 *   "test_mode": "cross_validation"
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

    const { regions, test_mode } = body as {
      regions?: string[];
      test_mode?: string;
    };

    // 1. Validation of optional parameters
    if (regions && (!Array.isArray(regions) || regions.some((r) => typeof r !== "string"))) {
      return NextResponse.json(
        { error: "Invalid 'regions'. Must be an array of region codes (strings)." },
        { status: 400 }
      );
    }
    if (test_mode && typeof test_mode !== "string") {
      return NextResponse.json(
        { error: "Invalid 'test_mode'. Must be a string." },
        { status: 400 }
      );
    }

    // 2. Execute Generalization Pipeline
    console.log(
      `[API_GENERALIZATION] Starting generalization and stress test evaluation. Regions: ${
        regions ? regions.join(", ") : "All (CDMX, VER, TAB, NL, JAL, GLOBAL)"
      } | Mode: ${test_mode || "cross_validation"}`
    );

    const engine = new IRIGeneralizationEngine();

    try {
      const report = await engine.evaluateGeneralization(regions, test_mode);

      console.log(
        `[API_GENERALIZATION] Completed successfully. GS: ${report.generalization_score} | Drift: ${report.spatial_drift} | Stability: ${report.stability_score}`
      );

      return NextResponse.json({
        generalization_score: report.generalization_score,
        spatial_drift: report.spatial_drift,
        stability_score: report.stability_score,
        train_performance: report.train_performance,
        test_performance: report.test_performance,
        region_breakdown: report.region_breakdown,
        stress_test_results: report.stress_test_results,
        validation_samples_total: report.validation_samples_total,
      });
    } catch (pipelineError: any) {
      return NextResponse.json(
        {
          error: "Generalization validation pipeline failed.",
          details: pipelineError?.message || String(pipelineError),
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("[API_GENERALIZATION_ERROR] Unexpected internal server error:", error);
    return NextResponse.json(
      {
        error: "An unexpected internal server error occurred during generalization testing.",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
