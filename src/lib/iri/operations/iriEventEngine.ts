import { GeoCell, IRIEngine, IRICellResult } from "../iriEngine";
import { ProviderResponse } from "../../providers/baseProvider";

export interface GeoEvent {
  id: string;
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
  timestamp: string;
  iri_score: number;
  state: "NORMAL" | "WATCH" | "WARNING" | "ALERT" | "CRITICAL";
  sources: string[];
  signals: {
    hydrology: number;
    precipitation: number;
    osint: number;
    satellite: number;
  };
  metadata?: {
    active_triggers: string[];
  };
}

export interface OperationalCellState {
  cellId: string;
  lastIriScore: number;
  lastState: "NORMAL" | "WATCH" | "WARNING" | "ALERT" | "CRITICAL";
  timestamp: string;
}

export class IRIEventEngine {
  // Static history cache to simulate real-time temporal state tracking per cell ID
  private static cellStateHistory: Map<string, OperationalCellState> = new Map();

  private iriEngine: IRIEngine;
  private spikeThreshold = 0.15; // sudden spike threshold

  constructor() {
    this.iriEngine = new IRIEngine();
  }

  /**
   * Clears the historical temporal state of all operational cells.
   */
  public static clearHistory(): void {
    this.cellStateHistory.clear();
  }

  /**
   * Retrieves the previous state of a specific cell or returns a default baseline.
   */
  private getPreviousState(cellId: string): OperationalCellState {
    const historical = IRIEventEngine.cellStateHistory.get(cellId);
    if (historical) {
      return historical;
    }
    return {
      cellId,
      lastIriScore: 0.10, // baseline normal risk
      lastState: "NORMAL",
      timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago default
    };
  }

  /**
   * Saves the current operational state of a cell into our temporal cache.
   */
  private saveCellState(cellId: string, lastIriScore: number, lastState: GeoEvent["state"]): void {
    IRIEventEngine.cellStateHistory.set(cellId, {
      cellId,
      lastIriScore,
      lastState,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Computes the deterministic State Machine transition for a given cell.
   * State Hierarchy: NORMAL -> WATCH -> WARNING -> ALERT -> CRITICAL
   */
  public determineOperationalState(
    currentIri: number,
    previousState: "NORMAL" | "WATCH" | "WARNING" | "ALERT" | "CRITICAL",
    triggers: {
      hasSpike: boolean;
      extremeRain: boolean;
      convergentOsint: boolean;
      satelliteAnomaly: boolean;
    },
    signals: GeoEvent["signals"]
  ): "NORMAL" | "WATCH" | "WARNING" | "ALERT" | "CRITICAL" {
    // 1. EVENT FUSION CRITICAL RULE: IF (IRI HIGH + OSINT SIGNAL + SATELLITE ANOMALY) -> CRITICAL
    const hasFusionCritical =
      currentIri >= 0.55 &&
      signals.osint >= 0.50 &&
      signals.satellite >= 0.50;

    if (currentIri > 0.80 || hasFusionCritical || previousState === "CRITICAL" && currentIri > 0.70) {
      return "CRITICAL";
    }

    // 2. ALERT Rule: High IRI score or active severe pluvial/OSINT triggers
    if (
      currentIri > 0.60 ||
      (triggers.extremeRain && triggers.convergentOsint) ||
      (triggers.hasSpike && currentIri > 0.50)
    ) {
      return "ALERT";
    }

    // 3. WARNING Rule: Moderate IRI or combination of sensors + satellite anomaly
    if (
      currentIri > 0.40 ||
      (triggers.extremeRain && triggers.satelliteAnomaly) ||
      (triggers.hasSpike && currentIri > 0.35)
    ) {
      return "WARNING";
    }

    // 4. WATCH Rule: Mild IRI or any single active trigger
    if (
      currentIri > 0.20 ||
      triggers.extremeRain ||
      triggers.convergentOsint ||
      triggers.satelliteAnomaly ||
      triggers.hasSpike
    ) {
      return "WATCH";
    }

    // 5. NORMAL Baseline
    return "NORMAL";
  }

  /**
   * Logs cell operational state transition and trigger source traces cleanly.
   */
  private logOperationalTransition(
    eventId: string,
    cellId: string,
    prevState: string,
    newState: string,
    iriDelta: number,
    triggers: string[],
    signals: GeoEvent["signals"]
  ): void {
    const timestamp = new Date().toISOString();
    console.log(`[GEOINT_OPERATIONS_LOG]`);
    console.log(`  Timestamp:          ${timestamp}`);
    console.log(`  Event ID:           ${eventId}`);
    console.log(`  Cell ID:            ${cellId}`);
    console.log(`  State Transition:   ${prevState} -> ${newState}`);
    console.log(`  IRI Delta:          ${iriDelta >= 0 ? "+" : ""}${iriDelta.toFixed(3)}`);
    console.log(`  Trigger Sources:    [${triggers.join(", ")}]`);
    console.log(`  Signals breakdown:  Hydrology: ${signals.hydrology.toFixed(2)} | Precip: ${signals.precipitation.toFixed(2)} | OSINT: ${signals.osint.toFixed(2)} | Satellite: ${signals.satellite.toFixed(2)}`);
    console.log(`--------------------------------------------------------------------------------`);
  }

  /**
   * Processes a single cell operational loop (Event-Driven Pipeline).
   * unifies IRI Engine -> Event Detection -> Signal Fusion -> State Machine.
   */
  public processOperationalCell(
    cell: GeoCell,
    responses: Record<string, ProviderResponse>
  ): GeoEvent | null {
    const defaultDate = new Date().toISOString();
    
    // 1. Evaluate current IRI
    const cellResult = this.iriEngine.evaluateIRI(cell, responses);
    const currentIri = cellResult.iri_score;

    // 2. Fetch temporal baseline
    const previous = this.getPreviousState(cell.id);
    const prevIri = previous.lastIriScore;
    const prevState = previous.lastState;

    // 3. Extract signals (hydrology, precipitation, osint, satellite factors)
    const signals = {
      hydrology: cellResult.breakdown.hydrology,
      precipitation: cellResult.breakdown.precipitation,
      osint: cellResult.breakdown.osint,
      satellite: cellResult.breakdown.satellite,
    };

    // 4. DETECT TRIGGERS
    // Trigger 1 — IRI Spike
    const iriDelta = currentIri - prevIri;
    const hasSpike = iriDelta > this.spikeThreshold;

    // Trigger 2 — Lluvia Extrema (precipitation factor > 0.70)
    const extremeRain = signals.precipitation > 0.70;

    // Trigger 3 — OSINT convergente (osint factor > 0.60)
    const convergentOsint = signals.osint > 0.60;

    // Trigger 4 — Anomalía Satelital (satellite factor > 0.65)
    const satelliteAnomaly = signals.satellite > 0.65;

    const activeTriggerNames: string[] = [];
    if (hasSpike) activeTriggerNames.push("IRI_SPIKE");
    if (extremeRain) activeTriggerNames.push("EXTREME_RAIN");
    if (convergentOsint) activeTriggerNames.push("CONVERGENT_OSINT");
    if (satelliteAnomaly) activeTriggerNames.push("SATELLITE_ANOMALY");

    // NOAA Specific Trigger 2 — Storm event match: storm_event + IRI spike -> CRITICAL EVENT
    const hasNoaa = responses["noaa"]?.status === "ok";
    const isNoaaStorm = hasNoaa && ((responses["noaa"]?.payload as any)?.payload?.meteorology || 0) > 0.5;
    const noaaStormMatch = isNoaaStorm && hasSpike;
    if (noaaStormMatch) {
      activeTriggerNames.push("NOAA_STORM_MATCH");
    }

    // HydroFusion Specific Trigger — Coordinated physical flood truth alarm (extreme risk or dam overspill match)
    const hasHydroFusion = responses["hydro_fusion"]?.status === "ok";
    const hydroFusionPayload = hasHydroFusion ? (responses["hydro_fusion"]?.payload as any)?.payload : null;
    const isHydroCritical = hydroFusionPayload && (hydroFusionPayload.fused_metrics?.combined_physical_risk > 0.75);
    const damAlert = hydroFusionPayload && (hydroFusionPayload.fused_metrics?.dam_risk_factor > 0.85);
    const hydroFusionMatch = (isHydroCritical || damAlert) && (hasSpike || extremeRain);
    if (hydroFusionMatch) {
      activeTriggerNames.push("HYDRO_FUSION_PHYSICAL_TRUTH_ALERT");
    }

    // 5. DETERMINE STATE
    let newState = this.determineOperationalState(
      currentIri,
      prevState,
      { hasSpike, extremeRain, convergentOsint, satelliteAnomaly },
      signals
    );

    if (noaaStormMatch || hydroFusionMatch) {
      newState = "CRITICAL";
    }

    // 6. SAVE STATE
    this.saveCellState(cell.id, currentIri, newState);

    // 7. RECORD AND LOG TRANSITION
    // Generate event ID sequentially/deterministically
    const eventId = `EVT-${cell.id.replace("cell_250m_", "").toUpperCase()}-${Date.now().toString().slice(-6)}`;

    if (newState !== "NORMAL" || prevState !== "NORMAL") {
      this.logOperationalTransition(
        eventId,
        cell.id,
        prevState,
        newState,
        iriDelta,
        activeTriggerNames.length > 0 ? activeTriggerNames : ["PERIODIC_HEARTBEAT"],
        signals
      );
    }

    // Only output a GeoEvent if the state is non-normal (alerting / operational threshold exceeded)
    if (newState !== "NORMAL") {
      // Gather active data sources
      const sources = cellResult.metadata.data_sources;

      return {
        id: eventId,
        geometry: cell.geometry,
        timestamp: defaultDate,
        iri_score: currentIri,
        state: newState,
        sources,
        signals,
        metadata: {
          active_triggers: activeTriggerNames.length > 0 ? activeTriggerNames : ["PERIODIC_HEARTBEAT"]
        }
      };
    }

    return null;
  }
}
