import { NextResponse } from "next/server";
import { IRIEngine, GeoCell } from "@/lib/iri/iriEngine";
import { IRIEventEngine, GeoEvent } from "@/lib/iri/operations/iriEventEngine";
import { IRIGeneralizationEngine } from "@/lib/iri/validation/iriGeneralizationEngine";

export const runtime = "nodejs";
export const maxDuration = 60; // 60s max execution time

// Initialize engines
const eventEngine = new IRIEventEngine();
const genEngine = new IRIGeneralizationEngine();
const baseEngine = new IRIEngine();

/**
 * POST /api/iri/events
 *
 * Near Real-Time Event Fusion & Detection endpoint.
 * Accepts a bounding box, segments it into a grid of cells, fetches/simulates
 * operational telemetry (meteorology, hydrology, OSINT, satellite), runs the State Machine,
 * and outputs active GeoEvents.
 *
 * Input:
 * {
 *   "bbox": [minLat, minLng, maxLat, maxLng],
 *   "mode": "realtime",
 *   "clear_history": false,
 *   "simulated_storm": true
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

    const { bbox, mode, clear_history, simulated_storm } = body;

    // Optional: Clear static history cache
    if (clear_history === true) {
      IRIEventEngine.clearHistory();
      console.log("[API_EVENTS] Temporal Operational cell state history cache cleared.");
    }

    // 1. Resolve BBOX
    let resolvedBbox: [number, number, number, number] = [21.84, -102.32, 21.92, -102.26]; // Default: Aguascalientes center
    if (bbox) {
      if (!Array.isArray(bbox) || bbox.length !== 4 || bbox.some((n) => typeof n !== "number")) {
        return NextResponse.json(
          { error: "Invalid 'bbox'. Must be an array of 4 coordinates [minLat, minLng, maxLat, maxLng]." },
          { status: 400 }
        );
      }
      resolvedBbox = bbox as [number, number, number, number];
    }

    const modeStr = mode || "realtime";
    const useStormSimulation = simulated_storm !== false;

    console.log(
      `[API_EVENTS] Fetching active events. BBOX: [${resolvedBbox.join(", ")}] | Mode: ${modeStr} | SimStorm: ${useStormSimulation}`
    );

    // 2. Grid Segmentation (250m cells)
    const cells = baseEngine.segmentBBox(resolvedBbox, 250);
    
    // Capping cells grid count to prevent resource depletion (max 100 cells for rapid API execution)
    const maxCells = 100;
    const activeCells = cells.slice(0, maxCells);

    // 3. Simulated Moving Pluvial Storm Center to trigger temporal updates (real-time feeling)
    // Moving center depends on seconds of the current clock time
    const seconds = new Date().getSeconds();
    const cycle = (seconds % 60) / 60; // 0.0 to 1.0

    const bboxCenterLat = (resolvedBbox[0] + resolvedBbox[2]) / 2;
    const bboxCenterLng = (resolvedBbox[1] + resolvedBbox[3]) / 2;
    
    // Storm moves in a micro-circle around BBOX centroid over a 1-minute cycle
    const radiusLat = (resolvedBbox[2] - resolvedBbox[0]) * 0.3;
    const radiusLng = (resolvedBbox[3] - resolvedBbox[1]) * 0.3;
    const stormLat = bboxCenterLat + Math.sin(cycle * 2 * Math.PI) * radiusLat;
    const stormLng = bboxCenterLng + Math.cos(cycle * 2 * Math.PI) * radiusLng;

    const activeEvents: GeoEvent[] = [];

    // 4. Operational processing loop per cell (Parallelized)
    const promises = activeCells.map(async (cell) => {
      const [lat, lng] = cell.centroid;

      // Calculate distance to the simulated storm center
      const distToStorm = Math.sqrt(
        Math.pow(lat - stormLat, 2) + Math.pow(lng - stormLng, 2)
      );
      
      // Determine simulated severity real
      let cellSeverity = 0.15; // default light baseline
      if (useStormSimulation) {
        // High severity near the moving storm center
        const maxDist = (resolvedBbox[2] - resolvedBbox[0]) * 0.5;
        const proximity = Math.max(0, 1 - distToStorm / maxDist); // 0.0 at edge, 1.0 at center
        cellSeverity = 0.10 + Math.pow(proximity, 1.8) * 0.85; // scales up to 0.95 at center
      }

      // Generate telemetry realistically matching the local cell severity
      // We override the longitude of our virtual river corridor to make calculations physically high-fidelity
      const responses = genEngine.generateMockResponses(lat, -102.315, cellSeverity * 15, cellSeverity);

      // Run Event-driven operational cell processor
      const geoEvent = eventEngine.processOperationalCell(cell, responses);
      if (geoEvent) {
        activeEvents.push(geoEvent);
      }
    });

    await Promise.all(promises);

    console.log(
      `[API_EVENTS] Complete. Processed ${activeCells.length} cells. Found ${activeEvents.length} active events with alerting states.`
    );

    return NextResponse.json({
      active_events: activeEvents,
      metadata: {
        total_grid_cells_processed: activeCells.length,
        active_events_count: activeEvents.length,
        storm_centroid_simulated: [stormLat, stormLng],
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[API_EVENTS_ERROR] Unexpected internal server error:", error);
    return NextResponse.json(
      {
        error: "An unexpected internal server error occurred during events processing.",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
