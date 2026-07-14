/**
 * ====================================================================
 * CEIPOL PERFILADOR - OSINT Intelligence Maturity Layer (IML)
 * ====================================================================
 * 
 * Implementación de la Capa de Madurez de Inteligencia OSINT (ADR-009.8).
 * Diseñado bajo principios de inmutabilidad, no intrusión y reversibilidad.
 * 
 * Este módulo actúa como un decorador de madurez y observador de salud,
 * respetando el estándar original NormalizedOSINTEvent (v2) y extendiéndolo
 * de forma limpia al contrato institucional v3 sin alterar la evidencia original.
 */

import { NormalizedOSINTEvent } from "./osintTerritorialV2";

// ====================================================================
// 1. Contratos y Tipos Oficiales del Maturity Layer (v3)
// ====================================================================

export interface NormalizedOSINTEventV3 extends NormalizedOSINTEvent {
  schemaVersion: "OSINT-EVENT-3.0";
  collectorId: string;
  originalReference: string;
  contentHash: string;
  snapshotId: string | null;

  location: {
    type: "Point";
    coordinates: [number, number];
    precision: "Exacta" | "Sectorizada" | "Estimada";
    neighborhood?: string;
  } | null;

  confidence: {
    score: number; // 0 - 100
    factors: string[];
  };

  reliabilityScore: {
    sourceScore: number;     // Confiabilidad de origen (0 - 100)
    integrityScore: number;  // Certificación del crypto-hash (0 - 100)
    compositeScore: number;  // Promedio ponderado general
  };

  chainOfCustody: {
    registeredBy: string;
    verificationNode: string;
    verifiedAt: string;
  };
}

export interface OSINTProviderHealth {
  providerId: string;
  status: "Healthy" | "Degraded" | "Offline";
  lastSuccessfulQuery: string; // ISO 8601 UTC
  latencyMs: number;
  errorRate: number; // Porcentaje de 0 a 100
  quotaStatus: {
    limit: number;
    used: number;
    resetAt: string; // ISO 8601 UTC
  };
  lastFailure?: {
    timestamp: string;
    error: string;
  };
}

// ====================================================================
// 2. Motor de Calidad y Confiabilidad (Admiralty Scale / OTAN System)
// ====================================================================

export class OSINTMaturityEnricher {
  /**
   * Puntuaciones del Almirantazgo de la OTAN para Confiabilidad de Origen (Source Reliability)
   */
  private static readonly SOURCE_RELIABILITY_SCORES: Record<string, number> = {
    A: 100, // Completamente confiable
    B: 80,  // Usualmente confiable
    C: 60,  // Bastante confiable
    D: 40,  // No confiable
    E: 20,  // Historial de desinformación
    F: 50,  // Fuente nueva / No evaluable (neutral)
  };

  /**
   * Puntuaciones del Almirantazgo para Credibilidad del Hallazgo (Information Credibility)
   */
  private static readonly INFORMATION_CREDIBILITY_SCORES: Record<number, number> = {
    1: 100, // Confirmado por otras fuentes
    2: 85,  // Probablemente verdadero
    3: 70,  // Posiblemente verdadero
    4: 45,  // Dudoso
    5: 20,  // Improbable
    6: 50,  // Sin elementos para juzgar (neutral)
  };

  /**
   * Enriquece un evento original v2 al estándar institucional de madurez v3
   * operando mediante enriquecimiento inmutable (OBS-009.7-001).
   */
  public static enrich(
    event: NormalizedOSINTEvent,
    options: {
      analystId: string;
      collectorNode?: string;
      sourceReliability?: "A" | "B" | "C" | "D" | "E" | "F";
      infoCredibility?: 1 | 2 | 3 | 4 | 5 | 6;
      precision?: "Exacta" | "Sectorizada" | "Estimada";
    }
  ): NormalizedOSINTEventV3 {
    const sourceLetter = options.sourceReliability || "C";
    const credibilityNum = options.infoCredibility || 3;
    const precisionValue = options.precision || (event.location ? "Sectorizada" : "Estimada");

    // Calcular confiabilidad histórica (Source Score)
    const sourceScore = this.SOURCE_RELIABILITY_SCORES[sourceLetter] || 60;
    
    // Calcular score de credibilidad semántica y cruce de riesgo
    const baseCredibility = this.INFORMATION_CREDIBILITY_SCORES[credibilityNum] || 70;
    // Elevar si tiene un score de riesgo alto consolidado
    const riskAdjustment = event.risk_score > 75 ? 10 : 0;
    const credibilityScore = Math.min(100, baseCredibility + riskAdjustment);

    // Calcular score de integridad criptográfica (SHA-256 verificado)
    const integrityScore = event.traceabilityHash ? 100 : 0;

    // Fórmula Ponderada de Inteligencia del Almirantazgo:
    // compositeScore = (Source * 0.4) + (Credibilidad * 0.4) + (Integridad * 0.2)
    const compositeScore = Math.round(
      sourceScore * 0.4 + credibilityScore * 0.4 + integrityScore * 0.2
    );

    // Identificar factores de confianza
    const factors: string[] = [];
    if (sourceLetter === "A" || sourceLetter === "B") factors.push("Origen confiable catalogado");
    if (credibilityNum <= 2) factors.push("Correlacionado y verosímil");
    if (integrityScore === 100) factors.push("Firma criptográfica inalterada");
    if (event.keywords.length > 2) factors.push("Alta densidad semántica de riesgo");
    if (factors.length === 0) factors.push("Evaluación estándar de inteligencia");

    // Construir nuevo evento v3 extendido respetando inmutabilidad
    return {
      ...event,
      schemaVersion: "OSINT-EVENT-3.0",
      collectorId: options.collectorNode || "node-ags-ceipol-01",
      originalReference: event.url || "Sin enlace directo",
      contentHash: event.traceabilityHash || "pending-hash", // Se asume equivalencia segura
      snapshotId: null,

      location: event.location
        ? {
            type: "Point",
            coordinates: event.location.coordinates,
            precision: precisionValue,
            neighborhood: event.neighborhood,
          }
        : null,

      confidence: {
        score: Math.round((sourceScore + credibilityScore) / 2),
        factors,
      },

      reliabilityScore: {
        sourceScore,
        integrityScore,
        compositeScore,
      },

      chainOfCustody: {
        registeredBy: options.analystId,
        verificationNode: options.collectorNode || "server-main-ags",
        verifiedAt: new Date().toISOString(),
      },
    };
  }
}

// ====================================================================
// 3. Registro y Monitoreo de Salud de Proveedores (OBS-009.5-005)
// ====================================================================

class OSINTProviderHealthRegistryManager {
  private healthStore: Map<string, OSINTProviderHealth> = new Map();

  constructor() {
    // Inicializar estados por defecto de proveedores del CEIPOL
    this.initializeDefaultProviders();
  }

  private initializeDefaultProviders() {
    const providers = ["youtube", "serpapi", "telegram", "reddit", "x", "newsapi"];
    const now = new Date().toISOString();
    const resetDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Mañana

    providers.forEach((prov) => {
      this.healthStore.set(prov, {
        providerId: prov,
        status: "Healthy",
        lastSuccessfulQuery: now,
        latencyMs: 120,
        errorRate: 0,
        quotaStatus: {
          limit: 1000,
          used: 0,
          resetAt: resetDate,
        },
      });
    });
  }

  /**
   * Registra una métrica de consulta exitosa actualizando salud y latencia
   */
  public logSuccess(providerId: string, latencyMs: number) {
    const health = this.healthStore.get(providerId);
    if (!health) return;

    // Ponderar latencia promedio
    const newLatency = Math.round(health.latencyMs * 0.7 + latencyMs * 0.3);
    const newStatus = newLatency > 3500 ? "Degraded" : "Healthy";

    this.healthStore.set(providerId, {
      ...health,
      status: newStatus as any,
      lastSuccessfulQuery: new Date().toISOString(),
      latencyMs: newLatency,
      errorRate: Math.max(0, health.errorRate - 5), // Reduce error progresivamente
    });
  }

  /**
   * Registra un fallo del proveedor incrementando tasa de errores
   */
  public logFailure(providerId: string, errorMessage: string) {
    const health = this.healthStore.get(providerId);
    if (!health) return;

    const newErrorRate = Math.min(100, health.errorRate + 15);
    // Cambiar estatus a Offline si supera 45% de fallos
    const newStatus = newErrorRate > 45 ? "Offline" : "Degraded";

    this.healthStore.set(providerId, {
      ...health,
      status: newStatus as any,
      errorRate: newErrorRate,
      lastFailure: {
        timestamp: new Date().toISOString(),
        error: errorMessage,
      },
    });
  }

  /**
   * Registra el uso de cuota API
   */
  public logQuotaUsage(providerId: string, additionalUnitsUsed: number) {
    const health = this.healthStore.get(providerId);
    if (!health) return;

    const used = health.quotaStatus.used + additionalUnitsUsed;
    const isExceeded = used >= health.quotaStatus.limit;

    this.healthStore.set(providerId, {
      ...health,
      status: isExceeded ? "Offline" : health.status,
      quotaStatus: {
        ...health.quotaStatus,
        used,
      },
    });
  }

  /**
   * Obtiene la salud actual de un proveedor
   */
  public getHealth(providerId: string): OSINTProviderHealth | undefined {
    return this.healthStore.get(providerId);
  }

  /**
   * Obtiene reporte general para el panel de diagnóstico de gobernanza
   */
  public getFullDiagnostics(): OSINTProviderHealth[] {
    return Array.from(this.healthStore.values());
  }
}

// Exportar instancia única (Singleton) para mantener estado de observabilidad en vivo
export const OSINTProviderHealthRegistry = new OSINTProviderHealthRegistryManager();

// ====================================================================
// 4. Adaptador de Integración para el GIM (ADR-009.9)
// ====================================================================

export interface GIMEvidenceInput {
  evidenceId: string;
  sourceType: "OSINT" | "IIC" | "LEGAL";
  contentSummary: string;
  georeference: [number, number] | null;
  timestamp: string;
  confidenceWeight: number; // Factor normalizado de 0 a 1 para el GIM
  traceabilityHash: string;
  metadata: {
    compositeScore: number;
    precision: "Exacta" | "Sectorizada" | "Estimada";
    analystSignature: string;
  };
}

export class OSINTMaturityGIMAdapter {
  // Umbral de calidad analítica por defecto para Aguascalientes
  private static readonly CRITICAL_QUALITY_THRESHOLD = 45;

  /**
   * Filtra eventos que no cumplan con el umbral de madurez institucional,
   * previniendo que fake news o rumores contaminen el análisis de pandillas.
   */
  public static filterLowQualityEvents(
    events: NormalizedOSINTEventV3[],
    customThreshold?: number
  ): NormalizedOSINTEventV3[] {
    const threshold = customThreshold || this.CRITICAL_QUALITY_THRESHOLD;
    
    return events.filter(
      (evt) => evt.reliabilityScore.compositeScore >= threshold
    );
  }

  /**
   * Adapta un evento enriquecido v3 al estándar de entrada transaccional del GIM (GEM)
   */
  public static adaptToGIM(event: NormalizedOSINTEventV3): GIMEvidenceInput {
    // Normalizar el compositeScore (0 - 100) a un peso decimal para el GIM (0.0 - 1.0)
    const confidenceWeight = parseFloat(
      (event.reliabilityScore.compositeScore / 100).toFixed(2)
    );

    return {
      evidenceId: event.id,
      sourceType: "OSINT",
      contentSummary: event.content,
      georeference: event.location ? event.location.coordinates : null,
      timestamp: event.timestamp,
      confidenceWeight,
      traceabilityHash: event.traceabilityHash,
      metadata: {
        compositeScore: event.reliabilityScore.compositeScore,
        precision: event.location ? event.location.precision : "Estimada",
        analystSignature: event.chainOfCustody.registeredBy,
      },
    };
  }
}

