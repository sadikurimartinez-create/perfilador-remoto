import { GeointReliabilityEngine } from "../infra/geointReliabilityEngine";

export interface PilotConfig {
  mode: "LIVE" | "PILOT" | "SIMULATION";
  providers: {
    noaa: boolean;
    conagua: boolean;
    cenapred: boolean;
    nasa: boolean;
    usgs: boolean;
    osint: boolean;
  };
  hitl: {
    required_for_critical: boolean;
    required_for_override: boolean;
  };
  iri: {
    max_threshold: number;
    clamp_enabled: boolean;
  };
  safety: {
    circuit_breaker_enabled: boolean;
    failover_enabled: boolean;
  };
}

export interface InterceptedEvent {
  id: string;
  severity: "NORMAL" | "WATCH" | "ALERT" | "CRITICAL_RESPONSE";
  description: string;
  payload: any;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "HOLD" | "AUTO_EXECUTED" | "MONITORED";
  timestamp: string;
}

export class GeointPilotController {
  private static instance: GeointPilotController | null = null;

  private config: PilotConfig;
  private eventQueue: Map<string, InterceptedEvent> = new Map();
  private lastProviderQuery: Map<string, number> = new Map();
  private throttleWindowsMs: Record<string, number> = {
    noaa: 4000,
    conagua: 4000,
    cenapred: 5000,
    nasa: 8000,
    usgs: 5000,
    osint: 3000
  };

  private constructor() {
    // 🟡 Default PilotConfig on initialization
    this.config = {
      mode: "PILOT",
      providers: {
        noaa: true,
        conagua: true,
        cenapred: true,
        nasa: true,
        usgs: true,
        osint: true
      },
      hitl: {
        required_for_critical: true,
        required_for_override: true
      },
      iri: {
        max_threshold: 1.0,
        clamp_enabled: true
      },
      safety: {
        circuit_breaker_enabled: true,
        failover_enabled: true
      }
    };

    // Pre-populate with some mock events if in pilot mode so the command center has data
    this.seedMockEvents();
  }

  public static getInstance(): GeointPilotController {
    if (!GeointPilotController.instance) {
      GeointPilotController.instance = new GeointPilotController();
    }
    return GeointPilotController.instance;
  }

  /**
   * Retrieves the current pilot configuration.
   */
  public getConfig(): PilotConfig {
    return { ...this.config };
  }

  /**
   * Updates the pilot configuration dynamically.
   */
  public updateConfig(newConfig: Partial<PilotConfig>): PilotConfig {
    this.config = {
      ...this.config,
      ...newConfig,
      providers: {
        ...this.config.providers,
        ...(newConfig.providers || {})
      },
      hitl: {
        ...this.config.hitl,
        ...(newConfig.hitl || {})
      },
      iri: {
        ...this.config.iri,
        ...(newConfig.iri || {})
      },
      safety: {
        ...this.config.safety,
        ...(newConfig.safety || {})
      }
    };
    console.log(`[PILOT_CONTROLLER] Configuration updated dynamically: Mode is now ${this.config.mode}`);
    return this.getConfig();
  }

  /**
   * Intercepts incoming events from the Decision/Event Engines and applies HITL or auto-process rules.
   */
  public interceptEvent(
    id: string,
    severity: "NORMAL" | "WATCH" | "ALERT" | "CRITICAL_RESPONSE",
    description: string,
    payload: any
  ): InterceptedEvent {
    let status: InterceptedEvent["status"] = "MONITORED";

    if (severity === "CRITICAL_RESPONSE") {
      if (this.config.hitl.required_for_critical) {
        status = "PENDING_APPROVAL";
      } else {
        status = "AUTO_EXECUTED";
        console.log(`[PILOT_CONTROLLER] WARNING: Auto-executing CRITICAL response because HITL is disabled.`);
      }
    } else if (severity === "ALERT") {
      status = "AUTO_EXECUTED";
      console.log(`[PILOT_CONTROLLER] Auto-processing ALERT event: "${description}" (Logged to pilot trace).`);
    } else {
      status = "MONITORED";
    }

    const event: InterceptedEvent = {
      id,
      severity,
      description,
      payload,
      status,
      timestamp: new Date().toISOString()
    };

    this.eventQueue.set(id, event);
    return event;
  }

  /**
   * Resolves a Human-in-the-Loop approval action for pending critical responses.
   */
  public resolveHITLAction(
    eventId: string,
    action: "APPROVE" | "REJECT" | "HOLD"
  ): InterceptedEvent {
    const event = this.eventQueue.get(eventId);
    if (!event) {
      throw new Error(`Event with ID ${eventId} not found in Pilot Queue.`);
    }

    if (event.severity !== "CRITICAL_RESPONSE") {
      throw new Error(`Event ${eventId} has severity ${event.severity} and does not require HITL validation.`);
    }

    let nextStatus: InterceptedEvent["status"] = "PENDING_APPROVAL";
    if (action === "APPROVE") {
      nextStatus = "APPROVED";
      console.log(`[PILOT_CONTROLLER] HITL APPROVAL: Event ${eventId} approved for operational execution.`);
    } else if (action === "REJECT") {
      nextStatus = "REJECTED";
      console.log(`[PILOT_CONTROLLER] HITL REJECTION: Event ${eventId} rejected. Execution cancelled.`);
    } else if (action === "HOLD") {
      nextStatus = "HOLD";
      console.log(`[PILOT_CONTROLLER] HITL HOLD: Event ${eventId} placed on temporary operational hold.`);
    }

    const updatedEvent: InterceptedEvent = {
      ...event,
      status: nextStatus,
      timestamp: new Date().toISOString()
    };

    this.eventQueue.set(eventId, updatedEvent);
    return updatedEvent;
  }

  /**
   * Returns throttling controls or executes standard providers with graceful cache/simulation fallback.
   */
  public async getThrottledProviderResponse<T>(
    providerId: string,
    fetchFn: () => Promise<T>,
    simulationFallbackFn: () => T
  ): Promise<{ data: T; source: "live" | "throttled_cache" | "simulation_fallback" }> {
    const now = Date.now();
    const lastQuery = this.lastProviderQuery.get(providerId) || 0;
    const window = this.throttleWindowsMs[providerId] || 3000;

    // 1. If provider is disabled in configuration, immediately fallback to simulation
    const isProviderEnabled = (this.config.providers as any)[providerId] !== false;
    if (!isProviderEnabled || this.config.mode === "SIMULATION") {
      return {
        data: simulationFallbackFn(),
        source: "simulation_fallback"
      };
    }

    // 2. Throttling guard: if queried too fast, protect backend resources
    if (now - lastQuery < window) {
      console.log(`[PILOT_CONTROLLER] Throttling triggered for provider: ${providerId}. Serving simulated fallback.`);
      return {
        data: simulationFallbackFn(),
        source: "throttled_cache"
      };
    }

    try {
      this.lastProviderQuery.set(providerId, now);
      const data = await fetchFn();
      return {
        data,
        source: "live"
      };
    } catch (err) {
      console.error(`[PILOT_CONTROLLER] Error executing live provider ${providerId}. Sliding into failover simulation.`);
      return {
        data: simulationFallbackFn(),
        source: "simulation_fallback"
      };
    }
  }

  /**
   * Applies the operational pilot OSINT degradation index rule.
   */
  public getOSINTDegradationFactor(): number {
    if (this.config.mode === "PILOT") {
      return 0.45; // 55% degradation for unverified OSINT signals during pilots
    }
    return 1.0;
  }

  /**
   * Retrieves active events in the queue.
   */
  public getEvents(): InterceptedEvent[] {
    return Array.from(this.eventQueue.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Gets counts of events for telemetry status.
   */
  public getTelemetryStats() {
    const events = this.getEvents();
    const active_events = events.length;
    const critical_pending = events.filter(
      (e) => e.severity === "CRITICAL_RESPONSE" && e.status === "PENDING_APPROVAL"
    ).length;

    // Get live health statuses of tracked providers
    const healthRegistry = GeointReliabilityEngine.getAllProviderHealths();
    const providers_health: Record<string, "healthy" | "stable" | "degraded" | "inactive"> = {};

    Object.entries(healthRegistry).forEach(([prov, health]) => {
      const score = health.confidence_score;
      if (score === 0) {
        providers_health[prov] = "inactive";
      } else if (score < 60) {
        providers_health[prov] = "degraded";
      } else if (score < 90) {
        providers_health[prov] = "stable";
      } else {
        providers_health[prov] = "healthy";
      }
    });

    // Determine aggregate system state
    let system_state = "STABLE";
    const unhealthyCount = Object.values(providers_health).filter((h) => h === "inactive" || h === "degraded").length;
    if (unhealthyCount >= 3) {
      system_state = "DEGRADED";
    } else if (critical_pending > 0) {
      system_state = "ATTENTION_REQUIRED";
    }

    return {
      mode: this.config.mode,
      iri_global: parseFloat((events.reduce((acc, curr) => acc + (curr.payload?.iri_score || 0.50), 0) / (active_events || 1)).toFixed(2)),
      active_events,
      critical_pending,
      providers_health,
      system_state
    };
  }

  /**
   * Populates the queue with starting operational data so command dashboards are populated.
   */
  private seedMockEvents() {
    this.interceptEvent(
      "evt_pilot_001",
      "CRITICAL_RESPONSE",
      "Riesgo de desborde extremo detectado en Río San Pedro (Sección Norte)",
      { iri_score: 0.92, latitude: 21.912, longitude: -102.312 }
    );

    this.interceptEvent(
      "evt_pilot_002",
      "ALERT",
      "Precipitación intensa acumulada excediendo 45mm en cabecera municipal",
      { iri_score: 0.75, latitude: 21.885, longitude: -102.291 }
    );

    this.interceptEvent(
      "evt_pilot_003",
      "WATCH",
      "Monitoreo de susceptibilidad por ladera saturada en zona montañosa Poniente",
      { iri_score: 0.38, latitude: 21.871, longitude: -102.355 }
    );

    this.interceptEvent(
      "evt_pilot_004",
      "CRITICAL_RESPONSE",
      "Nivel crítico de almacenamiento en Presa Plutarco Elías Calles",
      { iri_score: 0.88, latitude: 22.134, longitude: -102.416 }
    );
  }
}
export default GeointPilotController;
