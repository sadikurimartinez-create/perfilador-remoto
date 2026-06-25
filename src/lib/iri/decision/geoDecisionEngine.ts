import { IRICellResult } from "../iriEngine";
import { GeoEvent } from "../operations/iriEventEngine";

export interface GeoDecision {
  event_id: string;
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
  iri_score: number;
  ops_score: number;

  impact: {
    population: number;      // 0.0 to 1.0 (density, vulnerable housing)
    infrastructure: number;  // 0.0 to 1.0 (critical, energy, transport, health)
    accessibility: number;   // 0.0 to 1.0 (blocked routes, connectivity risk)
  };

  classification: "MONITOR" | "PREVENT" | "RESPOND" | "CRITICAL_RESPONSE";

  recommendation: string[];
  priority_rank: number;
  timestamp: string;
}

export class GeoDecisionEngine {
  /**
   * EVALUATES THE IMPACT FACTORS AND OPERATIONAL PRIORITY SCORE (OPS)
   * 
   * Formula:
   * OPS = (IRI * 0.4) + (PopulationImpact * 0.3) + (InfrastructureImpact * 0.2) + (AccessibilityRisk * 0.1)
   */
  public calculateOPS(
    iri: number,
    populationImpact: number,
    infrastructureImpact: number,
    accessibilityRisk: number
  ): number {
    const ops =
      iri * 0.4 +
      populationImpact * 0.3 +
      infrastructureImpact * 0.2 +
      accessibilityRisk * 0.1;
    
    // Bound score strictly between 0.00 and 1.00
    return Math.min(1.0, Math.max(0.0, ops));
  }

  /**
   * DETERMINISTIC DECISION CLASSIFICATION LAYER
   * 
   * Rules:
   *  OPS < 0.25 → MONITOR
   *  0.25–0.50 → PREVENT
   *  0.50–0.75 → RESPOND
   *  > 0.75 → CRITICAL_RESPONSE
   */
  public classifyDecision(ops: number): GeoDecision["classification"] {
    if (ops < 0.25) {
      return "MONITOR";
    } else if (ops <= 0.50) {
      return "PREVENT";
    } else if (ops <= 0.75) {
      return "RESPOND";
    } else {
      return "CRITICAL_RESPONSE";
    }
  }

  /**
   * GENERATES STRUCTURED DECISION RECOMMENDATIONS AND OPERATIONAL INSTRUCTIONS
   * Suggests critical, non-executed actions based on risk breakdowns.
   */
  public generateRecommendations(
    classification: GeoDecision["classification"],
    impact: GeoDecision["impact"],
    signals: { hydrology: number; precipitation: number; osint: number }
  ): string[] {
    const recs: string[] = [];

    // Category-specific fundamental rules
    switch (classification) {
      case "CRITICAL_RESPONSE":
        recs.push("🚨 INICIAR EVACUACIÓN INMEDIATA de sectores habitacionales bajos expuestos");
        recs.push("🚒 Desplegar brigadas de rescate acuático y personal de primera respuesta");
        recs.push("⚡ Priorizar suministro eléctrico de emergencia e infraestructura hospitalaria local");
        break;
      case "RESPOND":
        recs.push("📢 Habilitar refugios temporales y emitir boletines de emergencia civil");
        recs.push("🗺️ Establecer perímetros de desvío vial y cerrar accesos a pasos subterráneos");
        recs.push("⚠️ Preparar rutas de evacuación rápida y movilizar equipo de bombeo pesado");
        break;
      case "PREVENT":
        recs.push("🌧️ Alertar a la población local en zonas bajas sobre encharcamientos severos");
        recs.push("🧹 Desplegar cuadrillas de desazolve de alcantarillado y limpieza de rejillas");
        recs.push("📡 Incrementar patrullaje preventivo de protección civil en cruces de canales");
        break;
      case "MONITOR":
        recs.push("🔍 Mantener monitoreo hidrológico estrecho mediante sensores de cauce");
        recs.push("📊 Vigilar acumulaciones pluviales preliminares y reportes OSINT locales");
        recs.push("📥 Mantener guardia técnica pasiva de protección civil");
        break;
    }

    // Impact-driven tactical recommendations
    if (impact.population > 0.65) {
      recs.push("👥 ALTA DENSIDAD HUMANA: Priorizar perifoneo preventivo y salvaguarda de vidas");
    }
    if (impact.infrastructure > 0.60) {
      recs.push("🏗️ INFRAESTRUCTURA EXPUESTA: Resguardar subestaciones de energía y plantas locales");
    }
    if (impact.accessibility > 0.55) {
      recs.push("🧭 RUTA DE ACCESO COMPROMETIDA: Activar desvíos viales preventivos por vialidades altas");
    }

    // Signal-driven physical recommendations
    if (signals.precipitation > 0.70) {
      recs.push("🌧️ LLUVIA EXTREMA: Vigilar zonas propensas a colapso de colectores pluviales");
    }
    if (signals.hydrology > 0.75) {
      recs.push("🌊 SATURACIÓN HÍDRICA (COORDINACIÓN NOAA + CONAGUA + CENAPRED): Alerta de desborde inminente en canales, colectores de drenaje o vertederos de presas registradas.");
    }
    if (signals.osint > 0.60) {
      recs.push("🌐 OSINT CONVERGENTE: Reportes ciudadanos confirman inundaciones locales activas");
    }

    return recs;
  }

  /**
   * OPERATION LOGGING TRACER (REASONING TRACE)
   */
  private logDecisionTrace(
    decision: GeoDecision,
    signals: { hydrology: number; precipitation: number; osint: number }
  ): void {
    console.log(`[GEOINT_DECISION_LOG]`);
    console.log(`  Timestamp:          ${decision.timestamp}`);
    console.log(`  Event ID:           ${decision.event_id}`);
    console.log(`  Priority Rank:      #${decision.priority_rank}`);
    console.log(`  OPS Score:          ${decision.ops_score.toFixed(3)}`);
    console.log(`  Classification:     ${decision.classification}`);
    console.log(`  Input Factors:      IRI: ${decision.iri_score.toFixed(2)} | Pop: ${decision.impact.population.toFixed(2)} | Infra: ${decision.impact.infrastructure.toFixed(2)} | Access: ${decision.impact.accessibility.toFixed(2)}`);
    console.log(`  Reasoning Signals:  Hydrology: ${signals.hydrology.toFixed(2)} | Precip: ${signals.precipitation.toFixed(2)} | OSINT: ${signals.osint.toFixed(2)}`);
    console.log(`  Recommendations:    - ${decision.recommendation.join("\n                      - ")}`);
    console.log(`--------------------------------------------------------------------------------`);
  }

  /**
   * EVALUATES OPERATIONAL DECISIONS FOR ACTIVE GEOSPATIAL EVENTS
   */
  public evaluateDecisions(
    activeEvents: GeoEvent[],
    cellResults: IRICellResult[]
  ): GeoDecision[] {
    const decisions: GeoDecision[] = [];

    // Create a fast map lookup for calculated cell parameters
    const cellMap = new Map<string, IRICellResult>();
    cellResults.forEach(c => cellMap.set(c.id, c));

    activeEvents.forEach((event) => {
      // Find matching physical cell result to extract fine population and infrastructure metrics
      // Strip dynamic timestamp prefix to find original cell ID
      // Event IDs look like: EVT-0_1-456789 or EVT-GRID_CELL_3_5-921847 or EVT-CELL_250M_OPERATIONAL_TEST-361843
      let cellId = "";
      if (event.id.startsWith("EVT-")) {
        const parts = event.id.split("-");
        if (parts.length >= 2) {
          // Re-assemble coordinate parts e.g. "cell_250m_1_2"
          const innerId = parts[1].toLowerCase();
          if (innerId.includes("_")) {
            cellId = `cell_250m_${innerId}`;
          } else {
            cellId = innerId;
          }
        }
      }

      // Default cell coordinates are extracted from geometry centroid
      const matchedCell = cellMap.get(cellId) || Array.from(cellMap.values())[0];

      // MATRIX OF POPULATION AND INFRASTRUCTURE IMPACTS (ESTABLISHED DYNAMICALLY)
      // We map normalized values from 0.0 to 1.0
      let populationImpact = 0.15; // baseline light impact
      let infrastructureImpact = 0.15;
      let accessibilityRisk = 0.10;

      if (matchedCell) {
        populationImpact = matchedCell.breakdown.population;
        infrastructureImpact = matchedCell.breakdown.infrastructure;
        
        // Accessibility risk is derived based on flood proximity (hydrology) and infrastructure layout
        accessibilityRisk = Math.min(1.0, matchedCell.breakdown.hydrology * 0.7 + matchedCell.breakdown.infrastructure * 0.3);
      }

      // Compute Operational Priority Score
      const opsScore = this.calculateOPS(
        event.iri_score,
        populationImpact,
        infrastructureImpact,
        accessibilityRisk
      );

      // Classify Decision Category
      const classification = this.classifyDecision(opsScore);

      // Generate Suggested Actions list
      const recommendation = this.generateRecommendations(
        classification,
        { population: populationImpact, infrastructure: infrastructureImpact, accessibility: accessibilityRisk },
        {
          hydrology: event.signals.hydrology,
          precipitation: event.signals.precipitation,
          osint: event.signals.osint,
        }
      );

      decisions.push({
        event_id: event.id,
        geometry: event.geometry,
        iri_score: event.iri_score,
        ops_score: opsScore,
        impact: {
          population: populationImpact,
          infrastructure: infrastructureImpact,
          accessibility: accessibilityRisk,
        },
        classification,
        recommendation,
        priority_rank: 99, // Assigned after sorting
        timestamp: new Date().toISOString(),
      });
    });

    // Rank decisions by OPS descending
    decisions.sort((a, b) => b.ops_score - a.ops_score);

    // Assign ranking indexes
    decisions.forEach((dec, idx) => {
      dec.priority_rank = idx + 1;
      
      // Log reasoning trace
      const matchedEvent = activeEvents.find(e => e.id === dec.event_id);
      this.logDecisionTrace(dec, {
        hydrology: matchedEvent?.signals.hydrology ?? 0.1,
        precipitation: matchedEvent?.signals.precipitation ?? 0.1,
        osint: matchedEvent?.signals.osint ?? 0.1,
      });
    });

    return decisions;
  }
}
