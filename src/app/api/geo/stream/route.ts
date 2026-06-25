import { NextResponse } from "next/server";
import { IRIEngine } from "@/lib/iri/iriEngine";
import { IRIEventEngine } from "@/lib/iri/operations/iriEventEngine";
import { IRIGeneralizationEngine } from "@/lib/iri/validation/iriGeneralizationEngine";
import { GeoVisualEngine } from "@/lib/geo-visual/geoVisualEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60s max execution time

// Initialize engines
const eventEngine = new IRIEventEngine();
const genEngine = new IRIGeneralizationEngine();
const baseEngine = new IRIEngine();
const visualEngine = new GeoVisualEngine();

/**
 * GET /api/geo/stream
 *
 * Real-Time Visual Synchronization Stream Endpoint.
 * Resolves BBOX, computes active cell results with clock-synced live pluvial simulation,
 * triggers the Event State Machine, interpolates the Dynamic Heatmap, and compiles
 * a synchronized GEOINT packet.
 *
 * Query Params:
 *  - bbox: minLat,minLng,maxLat,maxLng (e.g. ?bbox=21.84,-102.32,21.92,-102.26)
 *  - simulated_storm: true/false
 *  - mode: realtime
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const bboxParam = searchParams.get("bbox");
    const simulatedStormParam = searchParams.get("simulated_storm");
    const mode = searchParams.get("mode") || "realtime";

    // 1. Resolve BBOX
    let bbox: [number, number, number, number] = [21.84, -102.32, 21.92, -102.26]; // Default Aguascalientes center
    if (bboxParam) {
      const parts = bboxParam.split(",").map(Number);
      if (parts.length === 4 && !parts.some(isNaN)) {
        bbox = parts as [number, number, number, number];
      } else {
        return NextResponse.json(
          { error: "Invalid 'bbox' format. Must be minLat,minLng,maxLat,maxLng" },
          { status: 400 }
        );
      }
    }

    const useStormSimulation = simulatedStormParam !== "false";

    // 2. Segment BBOX into cells (default resolution 250m)
    const allCells = baseEngine.segmentBBox(bbox, 250);
    // Cap grid cells count to prevent performance bottlenecks (max 100 cells)
    const activeCells = allCells.slice(0, 100);

    // 3. Sincronización Temporal & Storm movement linked to clock seconds
    const seconds = new Date().getSeconds();
    const cycle = (seconds % 60) / 60; // 0.0 to 1.0

    const bboxCenterLat = (bbox[0] + bbox[2]) / 2;
    const bboxCenterLng = (bbox[1] + bbox[3]) / 2;
    const radiusLat = (bbox[2] - bbox[0]) * 0.3;
    const radiusLng = (bbox[3] - bbox[1]) * 0.3;

    // Pluvial storm core moves dynamically over time to show near real-time changes
    const stormLat = bboxCenterLat + Math.sin(cycle * 2 * Math.PI) * radiusLat;
    const stormLng = bboxCenterLng + Math.cos(cycle * 2 * Math.PI) * radiusLng;

    const cellResults: any[] = [];
    const activeEvents: any[] = [];

    // 4. Process each cell through the GEOINT Pipeline
    for (const cell of activeCells) {
      const [lat, lng] = cell.centroid;

      // Distance to storm center for physical intensity calculations
      const distToStorm = Math.sqrt(
        Math.pow(lat - stormLat, 2) + Math.pow(lng - stormLng, 2)
      );

      let cellSeverity = 0.15; // default light baseline
      if (useStormSimulation) {
        const maxDist = (bbox[2] - bbox[0]) * 0.5;
        const proximity = Math.max(0, 1 - distToStorm / maxDist);
        cellSeverity = 0.10 + Math.pow(proximity, 1.8) * 0.85; // scales up to 0.95
      }

      // Generate consistent mock telemetry (aligned to our virtual river corridor)
      const responses = genEngine.generateMockResponses(lat, -102.315, cellSeverity * 15, cellSeverity);

      // Evaluate raw IRI
      const cellResult = baseEngine.evaluateIRI(cell, responses);
      cellResults.push(cellResult);

      // Feed into temporal Event Engine to detect transitions and events
      const event = eventEngine.processOperationalCell(cell, responses);
      if (event) {
        activeEvents.push(event);
      }
    }

    // 5. Build standard visual packet with colors, heatmaps, and streaming updates
    const visualPacket = visualEngine.assembleStreamingPacket(cellResults, activeEvents, bbox);

    console.log(
      `[GET_GEO_STREAM] Synced visual stream. BBOX: [${bbox.join(", ")}] | Cells: ${visualPacket.cells.length} | Active Events: ${visualPacket.events.length} | Heatmap points: ${visualPacket.heatmap.length}`
    );

    // Return visual packet matching expected outputs
    return NextResponse.json({
      cells: visualPacket.cells,
      events: visualPacket.events,
      heatmap: visualPacket.heatmap,
      iri_updates: visualPacket.iri_updates,
      metadata: {
        storm_centroid_simulated: [stormLat, stormLng],
        grid_resolution: 250,
        mode,
      },
      timestamp: visualPacket.timestamp,
    });
  } catch (error: any) {
    console.error("[GET_GEO_STREAM_ERROR] Internal server error in visualization stream:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred during visual streaming synthesis.",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
