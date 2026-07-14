import { GangEvidenceMatrix, GangValidationResult } from "./models/gangIntelligenceTypes";

export class GangEvidenceValidator {
  /**
   * Valida rigurosamente la calidad técnica y coherencia interna de una GangEvidenceMatrix (GEM).
   * No califica narrativa, no asume culpabilidades, ni reemplaza al motor central de ACE.
   */
  public static validate(matrix: GangEvidenceMatrix): GangValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    const validatedAt = new Date().toISOString();

    // 1. Integridad Estructural (Campos obligatorios presentes)
    if (!matrix) {
      errors.push("Matriz de evidencia GIM no provista (nula o indefinida).");
      return { status: "NOT_READY", confidence: 0, warnings, errors, validatedAt };
    }

    const requiredFields: (keyof GangEvidenceMatrix)[] = [
      "metadata",
      "presenceEvidence",
      "territorialInfluence",
      "graffitiEvidence",
      "osintEvidence",
      "traceabilityLog",
      "status"
    ];

    requiredFields.forEach((field) => {
      if (!matrix[field]) {
        errors.push(`Falta el campo obligatorio estructural: '${field}'.`);
      }
    });

    if (errors.length > 0) {
      return { status: "NOT_READY", confidence: 0, warnings, errors, validatedAt };
    }

    // 2. Mapeo de Nivel de Confianza (De Enumeración a Valor Numérico)
    let confidence = 0;
    const currentConf = matrix.presenceEvidence.confidence;
    if (currentConf === "HIGH") confidence = 85;
    else if (currentConf === "MEDIUM") confidence = 60;
    else if (currentConf === "LOW") confidence = 30;
    else confidence = 0;

    // 3. Limitaciones Metodológicas
    const hasGraffiti = matrix.graffitiEvidence.length > 0;
    const hasOsint = matrix.osintEvidence?.events && matrix.osintEvidence.events.length > 0;

    if (hasGraffiti && !hasOsint) {
      warnings.push(
        "No existe confirmación documental suficiente; los elementos identificados representan indicios ambientales o referencias públicas sin corroboración de eventos."
      );
    }

    if (hasOsint && !hasGraffiti) {
      warnings.push(
        "Los reportes de fuentes abiertas (OSINT) registrados no cuentan con evidencia física o indicios visuales de campo correlacionados."
      );
    }

    // 4. Validación Territorial (Coherencia Espacial y Coordenadas)
    matrix.territorialInfluence.forEach((inf, idx) => {
      if (inf.approximateCoordinates) {
        const { lat, lng } = inf.approximateCoordinates;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          errors.push(
            `Coordenadas inválidas detectadas en la zona de influencia de '${inf.gangName}' (lat: ${lat}, lng: ${lng}).`
          );
        }
      } else if (inf.influenceType === "TERRITORIAL") {
        warnings.push(`El grupo '${inf.gangName}' declara influencia territorial pero carece de coordenadas aproximadas.`);
      }
    });

    matrix.osintEvidence.events.forEach((event) => {
      const { lat, lng } = event.coordinates;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        errors.push(`Coordenadas inválidas detectadas en el evento OSINT con ID '${event.eventId}'.`);
      }
      if (event.distanceMeters > 1000) {
        warnings.push(`El evento OSINT con ID '${event.eventId}' se encuentra fuera del área extendida de amortiguamiento (>1000m).`);
      }
    });

    // 5. Validación de Lenguaje de Datos (Detección de términos prohibidos)
    const prohibitedTerms = ["zona controlada", "territorio de la pandilla", "dominio criminal"];
    const textToScan = JSON.stringify(matrix).toLowerCase();

    prohibitedTerms.forEach((term) => {
      if (textToScan.includes(term)) {
        warnings.push(`Se detectó uso de terminología estigmatizante o restrictiva prohibida: '${term}'.`);
      }
    });

    // 6. Calificación de Estado de Disponibilidad Final basado en Reglas de Negocio GIM
    let status: "READY" | "READY_WITH_LIMITATIONS" | "NOT_READY" = "NOT_READY";

    if (errors.length > 0) {
      status = "NOT_READY";
    } else if (confidence >= 70) {
      status = "READY";
    } else if (confidence >= 40) {
      status = "READY_WITH_LIMITATIONS";
    } else {
      status = "NOT_READY";
    }

    // Si existen warnings de terminología proscrita o contradicciones metodológicas graves, degradar estatus para resguardo
    if (status === "READY" && warnings.length > 0) {
      status = "READY_WITH_LIMITATIONS";
    }

    return {
      status,
      confidence,
      warnings,
      errors,
      validatedAt
    };
  }

  /**
   * Suite de pruebas de validación interna estática obligatoria (Sanity Test Suite)
   */
  public static runSelfDiagnosticTests(): { testId: string; pass: boolean; result: GangValidationResult }[] {
    const results: { testId: string; pass: boolean; result: GangValidationResult }[] = [];

    // TEST-001: GEM completa y válida
    const gem001: GangEvidenceMatrix = {
      metadata: { module: "GIM", version: "1.0.0", generatedAt: new Date().toISOString(), schemaVersion: "ADR-008.2" },
      presenceEvidence: { status: "CONFIRMED", confidence: "HIGH", matchedGroups: ["Facción 13"], findingsCount: 2, remarks: "Normal" },
      territorialInfluence: [{ gangName: "Facción 13", subgroups: [], activityLevel: "LOW" as const, influenceType: "SYMBOLIC" as const, approximateCoordinates: { lat: 21.88, lng: -102.29 } }],
      graffitiEvidence: [{ id: "g-1", veeReferenceId: "v-1", symbologyMatch: "S1", detectedGangName: "Facción 13", riskLevel: "BAJO", confidence: "HIGH", coordinates: { lat: 21.88, lng: -102.29 } }],
      osintEvidence: { eventsFound: 1, events: [{ eventId: "o-1", sourceUrl: "url", detectedGroup: "Facción 13", eventType: "RIÑA", coordinates: { lat: 21.88, lng: -102.29 }, distanceMeters: 100, validatedAt: new Date().toISOString() }] },
      traceabilityLog: [],
      status: "READY"
    };
    const res001 = this.validate(gem001);
    results.push({ testId: "TEST-001 (GEM Válida)", pass: res001.status === "READY" && res001.errors.length === 0, result: res001 });

    // TEST-002: GEM con grafitis pero sin corroboración documental (Osint)
    const gem002 = { ...gem001, osintEvidence: { eventsFound: 0, events: [] } };
    const res002 = this.validate(gem002);
    results.push({ testId: "TEST-002 (Graffiti sin OSINT)", pass: res002.status === "READY_WITH_LIMITATIONS" && res002.warnings.length > 0, result: res002 });

    // TEST-003: GEM con confianza baja
    const gem003 = { ...gem001, presenceEvidence: { ...gem001.presenceEvidence, confidence: "LOW" as const } };
    const res003 = this.validate(gem003);
    results.push({ testId: "TEST-003 (Confianza Baja)", pass: res003.status === "NOT_READY", result: res003 });

    // TEST-004: GEM con coordenadas inválidas
    const gem004 = {
      ...gem001,
      territorialInfluence: [{ gangName: "Facción 13", subgroups: [], activityLevel: "LOW" as const, influenceType: "SYMBOLIC" as const, approximateCoordinates: { lat: 99.0, lng: -102.29 } }]
    };
    const res004 = this.validate(gem004);
    results.push({ testId: "TEST-004 (Coordenadas Inválidas)", pass: res004.status === "NOT_READY" && res004.errors.length > 0, result: res004 });

    // TEST-005: Texto descriptivo con lenguaje prohibido
    const gem005 = {
      ...gem001,
      presenceEvidence: { ...gem001.presenceEvidence, remarks: "Los indicios sugieren que esta es una zona controlada por rivales." }
    };
    const res005 = this.validate(gem005);
    results.push({ testId: "TEST-005 (Lenguaje Prohibido Warning)", pass: res005.warnings.some(w => w.includes("zona controlada")), result: res005 });

    return results;
  }
}
