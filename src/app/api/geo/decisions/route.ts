import { NextResponse } from "next/server";
import { IRIEngine } from "@/lib/iri/iriEngine";
import { IRIEventEngine } from "@/lib/iri/operations/iriEventEngine";
import { IRIGeneralizationEngine } from "@/lib/iri/validation/iriGeneralizationEngine";
import { GeoDecisionEngine } from "@/lib/iri/decision/geoDecisionEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // Strictly dynamic to prevent production build static rendering errors
export const maxDuration = 60; // 60s max execution time

// Initialize engines
const baseEngine = new IRIEngine();
const eventEngine = new IRIEventEngine();
const genEngine = new IRIGeneralizationEngine();
const decisionEngine = new GeoDecisionEngine();

/**
 * POST /api/geo/decisions
 *
 * Near Real-Time GEOINT Operational Decision Support Endpoint.
 * Evaluates active events, assesses population & infrastructure impact, calculates
 * the Operational Priority Score (OPS), ranks events, and provides structured action recommendations.
 *
 * Input JSON:
 * {
 *   "bbox": [minLat, minLon, maxLat, maxLon],
 *   "event_mode": true
 * }
 */
export async function POST(req: Request) {
  try {
    let body: any = {};

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

    const { bbox, event_mode } = body;

    // 1. Resolve BBOX
    let resolvedBbox: [number, number, number, number] = [21.84, -102.32, 21.92, -102.26]; // Default Aguascalientes center
    if (bbox) {
      if (!Array.isArray(bbox) || bbox.length !== 4 || bbox.some((n) => typeof n !== "number")) {
        return NextResponse.json(
          { error: "Invalid 'bbox'. Must be an array of 4 coordinates [minLat, minLon, maxLat, maxLon]." },
          { status: 400 }
        );
      }
      resolvedBbox = bbox as [number, number, number, number];
    }

    const isEventMode = event_mode !== false;

    // 2. Segment BBOX into 250m cells
    const cells = baseEngine.segmentBBox(resolvedBbox, 250);
    const activeCells = cells.slice(0, 100); // Cap grid count to preserve high performance

    // 3. Dynamic Moving Storm center aligned to clock seconds (temporal real-time feels)
    const seconds = new Date().getSeconds();
    const cycle = (seconds % 60) / 60;

    const bboxCenterLat = (resolvedBbox[0] + resolvedBbox[2]) / 2;
    const bboxCenterLng = (resolvedBbox[1] + resolvedBbox[3]) / 2;
    const radiusLat = (resolvedBbox[2] - resolvedBbox[0]) * 0.3;
    const radiusLng = (resolvedBbox[3] - resolvedBbox[1]) * 0.3;
    const stormLat = bboxCenterLat + Math.sin(cycle * 2 * Math.PI) * radiusLat;
    const stormLng = bboxCenterLng + Math.cos(cycle * 2 * Math.PI) * radiusLng;

    const cellResults: any[] = [];
    const activeEvents: any[] = [];

    // 4. Run through Event Engine and calculate raw IRI & Events
    activeCells.forEach((cell) => {
      const [lat, lng] = cell.centroid;

      const distToStorm = Math.sqrt(
        Math.pow(lat - stormLat, 2) + Math.pow(lng - stormLng, 2)
      );

      let cellSeverity = 0.15; // default light baseline
      // High intensity storm behavior
      const maxDist = (resolvedBbox[2] - resolvedBbox[0]) * 0.5;
      const proximity = Math.max(0, 1 - distToStorm / maxDist);
      cellSeverity = 0.10 + Math.pow(proximity, 1.8) * 0.85;

      // Generate mock responses (using our physical river coordinate -102.315)
      const responses = genEngine.generateMockResponses(lat, -102.315, cellSeverity * 15, cellSeverity);

      // Evaluate raw IRI and collect breakdown
      const cellResult = baseEngine.evaluateIRI(cell, responses);
      cellResults.push(cellResult);

      // Feed into temporal Event engine to register operational events
      const event = eventEngine.processOperationalCell(cell, responses);
      if (event) {
        activeEvents.push(event);
      }
    });

    // 5. Evaluate Operational Decisions and prioritize zones
    const decisions = decisionEngine.evaluateDecisions(activeEvents, cellResults);

    console.log(
      `[POST_DECISIONS] Evaluated ${cellResults.length} grid cells. Found ${activeEvents.length} events, compiled ${decisions.length} prioritized decisions.`
    );

    return NextResponse.json({
      decisions: decisions.map(d => ({
        event_id: d.event_id,
        classification: d.classification,
        ops_score: Number(d.ops_score.toFixed(3)),
        priority_rank: d.priority_rank,
        recommendation: d.recommendation,
        impact: d.impact,
        iri_score: Number(d.iri_score.toFixed(3)),
        geometry: d.geometry,
        timestamp: d.timestamp
      })),
      metadata: {
        total_cells_analyzed: activeCells.length,
        total_active_events: activeEvents.length,
        total_decisions_compiled: decisions.length,
        storm_centroid_simulated: [stormLat, stormLng],
        event_mode_active: isEventMode,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error("[POST_DECISIONS_ERROR] Internal server error evaluating decisions:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred during decisions evaluations.",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
