import { 
  EvidenceGovernanceEngine, 
  IntelligenceEvidenceObject,
  EvidenceType,
  EvidenceNature,
  EvidenceValidationState
} from "../src/utils/evidenceGovernanceEngine";
import { ReportQualityGate } from "../src/utils/reportQualityGate";
import { IntelligenceReportPayload, IntelligenceBriefing } from "../src/utils/intelligenceLayoutEngine";
import { HypothesisLifecycleManager } from "../src/utils/hypothesisLifecycle";

// Base payload compatible con los validadores del ADR-010 y ADR-011
const basePayload: IntelligenceReportPayload = {
  projectName: "Test EGE",
  projectId: "lALwSyWz0PGiMyJE1GMr",
  date: "16/07/2026",
  analyst: "Analista de Gobernanza",
  geometryType: "Polígono",
  areaGeografica: "Sector Centro",
  contextoTerritorial: `
    [HECHO OBSERVADO] Maleza alta y barda colapsada en la zona analizada.
    [EVIDENCIA UTILIZADA] Sustentado en fotografía 03 del álbum de campo, origen y datos de la fuente del registro de incidencia.
    [INFERENCIA ANALÍTICA] Esto representa un factor de oportunidad debido a la pérdida de vigilancia natural del entorno, lo que provoca vulnerabilidad compatible con conductas delictivas.
    [NIVEL DE CONFIANZA] Nivel de confianza: ALTO con fundamento geográfico sólido.
    [IMPLICACIÓN OPERACIONAL] Recorrido táctico de patrullaje preventivo y vigilancia en horario nocturno de 18:00 a 22:00 horas.
  `,
  finalHypothesis: `
    [HECHO OBSERVADO] Falta de iluminación en el perímetro del sector.
    [EVIDENCIA UTILIZADA] Sustentado en fotografía 01 de campo y registros de datos de incidencia delictiva.
    [INFERENCIA ANALÍTICA] Condición asociada con un factor de oportunidad debido a pérdida de control.
    [NIVEL DE CONFIANZA] Nivel de confianza: ALTO con fundamento.
    [IMPLICACIÓN OPERACIONAL] Patrullaje de precisión en horario de 19:00 a 22:00 horas.
  `,
  hipotesisPrincipal: {
    queOcurre: "Actividad delictiva disonante",
    dondeOcurre: "Ubicación focalizada",
    quienParticipa: "Individuos no identificados",
    porQueOcurre: "Ausencia de controles situacionales",
    evidenciaSustento: "Registros históricos",
    nivelConfianza: "Medio"
  },
  valoracionOperacional: {
    amenaza: "Oportunidad situacional",
    oportunidadCriminal: "Facilidad de tránsito disuasivo",
    vulnerabilidades: "Falta de iluminación",
    capacidadRequerida: "Patrullaje preventivo"
  },
  trazabilidadMatrix: [],
  maps: [
    {
      title: "Mapa",
      dataUrl: "data:image/png;base64,123",
      interpretation: `
        [HECHO OBSERVADO] Densidad de eventos en cuadrante sur del mapa.
        [EVIDENCIA UTILIZADA] Sustentado en fotografía cartográfica del mapa e incidencia de datos del SEM.
        [INFERENCIA ANALÍTICA] Se asocia con baja iluminación debido a pérdida de vigilancia, lo que incrementa la oportunidad.
        [NIVEL DE CONFIANZA] Nivel de confianza: ALTO con fundamento geográfico.
        [IMPLICACIÓN OPERACIONAL] Recorridos de patrullaje preventivo y vigilancia en horario de 19:00 a 22:00 horas.
      `
    }
  ],
  graphs: [
    {
      title: "Gráfica",
      dataUrl: "data:image/png;base64,123",
      explanation: `
        [HECHO OBSERVADO] Pico de incidencia los viernes por la noche en la gráfica.
        [EVIDENCIA UTILIZADA] Sustentado en captura de imagen estadística y datos de la fuente.
        [INFERENCIA ANALÍTICA] Tendencia de incidencia asociada con nula iluminación nocturna que provoca un factor de oportunidad.
        [NIVEL DE CONFIANZA] Nivel de confianza: ALTO con fundamento estadístico.
        [IMPLICACIÓN OPERACIONAL] Patrullaje disuasivo y recorridos de vigilancia los viernes en horario de 20:00 a 23:00 horas.
      `,
      finding: "Hallazgo",
      relation: "Relación"
    }
  ],
  photoEvidence: [
    {
      id: "p-1",
      dataUrl: "data:image/png;base64,123",
      caption: "Barda colapsada",
      location: "Sector norte",
      factor: "Baldío",
      criminologicalInterpretation: `
        [HECHO OBSERVADO] Predio baldío sin cerco.
        [EVIDENCIA UTILIZADA] Sustentado en fotografía 01 del álbum de campo, origen de datos de incidencia.
        [INFERENCIA ANALÍTICA] Vulnerabilidad ambiental compatible con demerito que provoca pérdida de vigilancia natural e incrementa la oportunidad debido a abandono.
        [NIVEL DE CONFIANZA] Nivel de confianza: ALTO con fundamento empírico.
        [IMPLICACIÓN OPERACIONAL] Recorridos preventivos de patrullaje y presencia táctica en horario de 18:00 a 22:00 horas.
      `,
      relation: "Relación",
      riskLevel: "MEDIO"
    }
  ],
  streetViewAnalysis: [
    {
      id: "sv-1",
      title: "Street View",
      observed: `
        [HECHO OBSERVADO] Terreno baldío sin vallar en el área analizada.
        [EVIDENCIA UTILIZADA] Imagen Street View del expediente y datos de la fuente municipal.
        [INFERENCIA ANALÍTICA] Representa una condición de vulnerabilidad ambiental debido a abandono que provoca un factor de oportunidad.
        [NIVEL DE CONFIANZA] Nivel de confianza: ALTO con fundamento y trazabilidad de origen.
        [IMPLICACIÓN OPERACIONAL] Recorridos preventivos de patrullaje y presencia de vigilancia en horario de 19:00 a 22:00 horas.
      `,
      location: "21.8,-102.2",
      dataUrl: "data:image/png;base64,123"
    }
  ],
  hypothesisGraph: {
    title: "Grafo",
    dataUrl: "data:image/png;base64,123",
    interpretation: `
      [HECHO OBSERVADO] Conectores de alta densidad de relación.
      [EVIDENCIA UTILIZADA] Sustentado en imagen del grafo de hipótesis de incidencia.
      [INFERENCIA ANALÍTICA] Demuestra correlación espacial debido a pérdida de vigilancia que provoca oportunidad.
      [NIVEL DE CONFIANZA] Nivel de confianza: ALTO con fundamento.
      [IMPLICACIÓN OPERACIONAL] Patrullaje focalizado y recorridos en horario de 20:00 a 23:00 horas.
    `
  },
  osintSynthesized: `
    HALLAZGO:
    Reportes de prensa local confirman asaltos nocturnos en calles aledañas.
    
    EVIDENCIA:
    Sustentado en capturas del portal de noticias e imagen de fuente municipal.
    
    ANÁLISIS:
    Coincide con baja iluminación en el área del baldío debido a desatención, lo cual provoca pérdida de vigilancia natural.
    
    IMPLICACIÓN OPERATIVA:
    Patrullaje preventivo de precisión y recorridos en el sector norte en horario de 20:00 a 23:00 horas.
  `,
  pandillasAnalysis: `
    [HECHO OBSERVADO] Pintas de graffiti territorial en barda norte.
    [EVIDENCIA UTILIZADA] Sustentado en fotografía 03 del álbum de campo, origen y datos de la fuente.
    [INFERENCIA ANALÍTICA] Expresiones asociadas a demerito visual y vandalismo urbano debido a pérdida de control.
    [NIVEL DE CONFIANZA] Nivel de confianza: ALTO con fundamento.
    [IMPLICACIÓN OPERACIONAL] Patrullaje disuasivo preventivo y vigilancia táctica en horario de 17:00 a 21:00 horas.
  `,
  sweepsData: [],
  conclusiones: {
    hallazgosCriticos: [
      "[HECHO OBSERVADO] Luminaria sin funcionamiento.",
      "[EVIDENCIA UTILIZADA] Sustentado en fotografía 04 del álbum e incidencia de datos.",
      "[INFERENCIA ANALÍTICA] Causa desatención debido a pérdida de iluminación lo que provoca un factor de oportunidad.",
      "[NIVEL DE CONFIANZA] Nivel de confianza: ALTO con fundamento de origen.",
      "[IMPLICACIÓN OPERACIONAL] Patrullaje preventivo de vigilancia en horario de 18:00 a 22:00 horas."
    ],
    riesgosInmediatos: [],
    escenariosFuturos: [],
    recomendacionesTacticas: [],
    recomendacionesEstrategicas: []
  },
  executiveSummary: "Resumen de perfil táctico.",
  hieData: { evidence: 1 } as any,
  cieData: { totalEvents: 1 } as any,
  sieData: { temporal: { totalEventos: 1 } } as any
};

const briefingDummy: IntelligenceBriefing = {
  pages: [
    { mode: "cover" },
    { mode: "hypothesis" }
  ]
} as any;

function runEGETests() {
  console.log("=== INICIANDO SUITE DE PRUEBAS ADR-012 (EVIDENCE GOVERNANCE ENGINE) ===");

  // Creamos la hipótesis de trayectoria del ADR-011 para pasar sus filtros de evolución obligatoria
  let hypothesis = HypothesisLifecycleManager.create(
    "lALwSyWz0PGiMyJE1GMr",
    "Establecer la correlación entre baldíos urbanos desatendidos e incidencia."
  );
  hypothesis = HypothesisLifecycleManager.transition(
    hypothesis,
    "EN_ANALISIS",
    "AMPLIACION",
    [],
    "Se inicia el análisis de campo."
  );

  // ==========================================================
  // TEST 1: Registro exitoso de evidencias múltiples con pesos calculados
  // ==========================================================
  console.log("\n[TEST 1] Registrando evidencias de múltiples orígenes...");
  
  const photoRaw = {
    expedienteId: "lALwSyWz0PGiMyJE1GMr",
    tipo: "FIELD_PHOTO" as EvidenceType,
    naturaleza: "OBSERVACIONAL" as EvidenceNature,
    fuente: "Fotografía de Álbum de Campo 01",
    fechaCaptura: Date.now() - (5 * 24 * 60 * 60 * 1000), // Hace 5 días
    capturadaPor: "Analista de Campo",
    descripcion: "Imagen de luminaria con cableado cortado y vandalizado.",
    ubicacion: "21.89,-102.28",
    archivoReferencia: "foto01.jpg",
    hipotesisRelacionadas: [hypothesis.id],
    capacidadesInferenciales: ["vulnerabilidad ambiental", "facilitador de oportunidad"],
    limitacionesInferenciales: ["presencia de cártel", "célula criminal organizada"],
    estadoValidacion: "VALIDADA" as EvidenceValidationState
  };

  const photoEv = EvidenceGovernanceEngine.registerEvidence(photoRaw);
  console.log(`- Evidencia Registrada (Foto): ID: ${photoEv.id}, Peso: ${photoEv.pesoEvidencial}, Confiabilidad: ${photoEv.nivelConfiabilidad}, Validación: ${photoEv.estadoValidacion}`);
  
  if (photoEv.pesoEvidencial === 100) { // 90 base + 10 por VALIDADA
    console.log("✅ TEST 1 PASADO: Registro y peso ponderado calculados correctamente.");
  } else {
    console.error("❌ TEST 1 FALLÓ: Peso incorrecto.");
  }

  // ==========================================================
  // TEST 2: Registro de eventos de uso y trazabilidad por capítulos
  // ==========================================================
  console.log("\n[TEST 2] Registrando eventos de trazabilidad de uso...");
  const loggedEv = EvidenceGovernanceEngine.logEvidenceUsage(
    photoEv,
    "Capítulo 10",
    "Se asocia la luminaria apagada con la pérdida de vigilancia natural en el perímetro.",
    "Analista Responsable"
  );

  console.log(`- Historial de uso eventos: ${loggedEv.historialUso.length}`);
  if (loggedEv.historialUso.length === 1 && loggedEv.historialUso[0].capituloDestino === "Capítulo 10") {
    console.log("✅ TEST 2 PASADO: Trazabilidad registrada exitosamente.");
  } else {
    console.error("❌ TEST 2 FALLÓ: Evento de trazabilidad no registrado.");
  }

  // ==========================================================
  // TEST 3: Bloqueo EGE-1 por uso de evidencia no validada
  // ==========================================================
  console.log("\n[TEST 3] Simulando Bloqueo EGE-1: Evidencia no validada utilizada...");
  const rawNotVal = {
    ...photoRaw,
    descripcion: "Evidencia sospechosa sin confirmar.",
    estadoValidacion: "OBSERVADA" as EvidenceValidationState
  };
  let evNotVal = EvidenceGovernanceEngine.registerEvidence(rawNotVal);
  // La marcamos como usada en Capítulo 10
  evNotVal = EvidenceGovernanceEngine.logEvidenceUsage(evNotVal, "Capítulo 10", "Se concluye riesgo por luminaria vandalizada.");

  const payloadTest3: IntelligenceReportPayload = {
    ...basePayload,
    hypothesisLifecycle: hypothesis,
    evidenceRegistry: [evNotVal]
  };

  try {
    ReportQualityGate.validate(payloadTest3, briefingDummy);
    console.error("❌ TEST 3 FALLÓ: Debió haber bloqueado debido a evidencia no validada utilizada.");
  } catch (err: any) {
    if (err.message.includes("[QUALITY GATE EGE - BLOQUEO 1]")) {
      console.log("✅ TEST 3 PASADO (Bloqueo exitoso):", err.message);
    } else {
      console.error("❌ TEST 3 FALLÓ con otro error:", err.message);
    }
  }

  // ==========================================================
  // TEST 4: Bloqueo EGE-2 por asimetría de confiabilidad (Confianza ALTO pero evidencia BAJA)
  // ==========================================================
  console.log("\n[TEST 4] Simulando Bloqueo EGE-2: Confiabilidad insuficiente para dictamen ALTO...");
  // Evidencia con confiabilidad BAJA debido a naturaleza DERIVADA y fecha muy antigua (más de un año) pero con estado VALIDADA para no detonar EGE-1.
  const rawLowReliability = {
    ...photoRaw,
    naturaleza: "DERIVADA" as EvidenceNature,
    fechaCaptura: Date.now() - (400 * 24 * 60 * 60 * 1000), // Hace 400 días (antigüedad > 365)
    estadoValidacion: "VALIDADA" as EvidenceValidationState, // peso = 30 base + 10 val - 20 edad = 20 (BAJA)
    hipotesisRelacionadas: [hypothesis.id]
  };
  let evLow = EvidenceGovernanceEngine.registerEvidence(rawLowReliability);
  evLow = EvidenceGovernanceEngine.logEvidenceUsage(evLow, "Conclusiones", "Análisis secundario de baja prioridad.");

  // Forzamos conclusiones a exigir Nivel de Confianza: ALTO
  const payloadTest4: IntelligenceReportPayload = {
    ...basePayload,
    hypothesisLifecycle: hypothesis,
    evidenceRegistry: [evLow],
    conclusiones: {
      hallazgosCriticos: [
        "[HECHO OBSERVADO] Luminaria sin funcionamiento.",
        "[EVIDENCIA UTILIZADA] Datos secundarios.",
        "[INFERENCIA ANALÍTICA] Causa desatención.",
        "[NIVEL DE CONFIANZA] Nivel de confianza: ALTO con fundamento.",
        "[IMPLICACIÓN OPERACIONAL] Patrullaje preventivo."
      ],
      riesgosInmediatos: [],
      escenariosFuturos: [],
      recomendacionesTacticas: [],
      recomendacionesEstrategicas: []
    }
  };

  try {
    ReportQualityGate.validate(payloadTest4, briefingDummy);
    console.error("❌ TEST 4 FALLÓ: Debió haber bloqueado por confiabilidad insuficiente.");
  } catch (err: any) {
    if (err.message.includes("[QUALITY GATE EGE - BLOQUEO 2]")) {
      console.log("✅ TEST 4 PASADO (Bloqueo exitoso):", err.message);
    } else {
      console.error("❌ TEST 4 FALLÓ con otro error:", err.message);
    }
  }

  // ==========================================================
  // TEST 5: Bloqueo EGE-3 por inferencia desbordada (Violación de limitaciones)
  // ==========================================================
  console.log("\n[TEST 5] Simulando Bloqueo EGE-3: Inferencia desbordada...");
  // Evidencia con limitaciones explícitas contra concluir cárteles/células criminales
  let evWithLimit = EvidenceGovernanceEngine.registerEvidence(photoRaw);
  // La usamos para justificar una presencia de "célula criminal organizada" (que está en las limitaciones de interpretación!)
  evWithLimit = EvidenceGovernanceEngine.logEvidenceUsage(
    evWithLimit, 
    "Capítulo 10", 
    "La luminaria rota demuestra la presencia activa de una célula criminal organizada de asaltantes."
  );

  const payloadTest5: IntelligenceReportPayload = {
    ...basePayload,
    hypothesisLifecycle: hypothesis,
    evidenceRegistry: [evWithLimit]
  };

  try {
    ReportQualityGate.validate(payloadTest5, briefingDummy);
    console.error("❌ TEST 5 FALLÓ: Debió haber bloqueado por violación de limitaciones de la evidencia.");
  } catch (err: any) {
    if (err.message.includes("[QUALITY GATE EGE - BLOQUEO 3]")) {
      console.log("✅ TEST 5 PASADO (Bloqueo exitoso):", err.message);
    } else {
      console.error("❌ TEST 5 FALLÓ con otro error:", err.message);
    }
  }

  // ==========================================================
  // TEST 6: Bloqueo EGE-4 por trazabilidad rota (Evidencia usada sin hipótesis asociada)
  // ==========================================================
  console.log("\n[TEST 6] Simulando Bloqueo EGE-4: Evidencia utilizada sin hipótesis asociada...");
  const rawUnlinked = {
    ...photoRaw,
    hipotesisRelacionadas: [] // SIN VINCULAR A NINGUNA HIPÓTESIS
  };
  let evUnlinked = EvidenceGovernanceEngine.registerEvidence(rawUnlinked);
  // Se usa en conclusiones finales
  evUnlinked = EvidenceGovernanceEngine.logEvidenceUsage(evUnlinked, "Capítulo 10", "Uso crítico final.");

  const payloadTest6: IntelligenceReportPayload = {
    ...basePayload,
    hypothesisLifecycle: hypothesis,
    evidenceRegistry: [evUnlinked]
  };

  try {
    ReportQualityGate.validate(payloadTest6, briefingDummy);
    console.error("❌ TEST 6 FALLÓ: Debió haber bloqueado por trazabilidad rota (evidencia sin hipótesis).");
  } catch (err: any) {
    if (err.message.includes("[QUALITY GATE EGE - BLOQUEO 4]")) {
      console.log("✅ TEST 6 PASADO (Bloqueo exitoso):", err.message);
    } else {
      console.error("❌ TEST 6 FALLÓ con otro error:", err.message);
    }
  }

  // ==========================================================
  // TEST 7: Bloqueo EGE-5 por utilizar evidencia IA/DERIVADA como primaria
  // ==========================================================
  console.log("\n[TEST 7] Simulando Bloqueo EGE-5: Evidencia generada por IA como primaria...");
  const rawIA = {
    ...photoRaw,
    naturaleza: "DERIVADA" as EvidenceNature,
    isIAGenerated: true,
    descripcion: "Análisis automatizado de vulnerabilidad."
  };
  let evIA = EvidenceGovernanceEngine.registerEvidence(rawIA);
  // Log de uso indicando que se intentó declarar como evidencia primaria
  evIA = EvidenceGovernanceEngine.logEvidenceUsage(evIA, "Evidencia Primaria", "Análisis automatizado.");

  const payloadTest7: IntelligenceReportPayload = {
    ...basePayload,
    finalHypothesis: "Nivel de confianza: MEDIO",
    conclusiones: {
      ...basePayload.conclusiones,
      hallazgosCriticos: [
        "[HECHO OBSERVADO] Luminaria sin funcionamiento.",
        "[EVIDENCIA UTILIZADA] Datos secundarios.",
        "[INFERENCIA ANALÍTICA] Causa desatención.",
        "[NIVEL DE CONFIANZA] Nivel de confianza: MEDIO.",
        "[IMPLICACIÓN OPERACIONAL] Patrullaje preventivo."
      ]
    },
    hypothesisLifecycle: hypothesis,
    evidenceRegistry: [evIA]
  };

  try {
    ReportQualityGate.validate(payloadTest7, briefingDummy);
    console.error("❌ TEST 7 FALLÓ: Debió haber bloqueado por uso de IA como evidencia primaria.");
  } catch (err: any) {
    if (err.message.includes("[QUALITY GATE EGE - BLOQUEO 5]")) {
      console.log("✅ TEST 7 PASADO (Bloqueo exitoso):", err.message);
    } else {
      console.error("❌ TEST 7 FALLÓ con otro error:", err.message);
    }
  }

  // ==========================================================
  // TEST 8: Evidencia contextual sin hipótesis (Debe pasar exitosamente)
  // ==========================================================
  console.log("\n[TEST 8] Evaluando paso de evidencia contextual sin hipótesis asociadas...");
  const rawContextual = {
    ...photoRaw,
    descripcion: "Fotografía panorámica del entorno urbano tomada desde dron.",
    hipotesisRelacionadas: [], // Contextual sin hipótesis asociada
    estadoValidacion: "VALIDADA" as EvidenceValidationState
  };
  let evContextual = EvidenceGovernanceEngine.registerEvidence(rawContextual);
  // La usamos para contexto geográfico (p. ej. en Capítulo 4 o mapas), NO para conclusiones analíticas finales ni hipótesis
  evContextual = EvidenceGovernanceEngine.logEvidenceUsage(evContextual, "Capítulo 4", "Imagen contextual del relieve territorial.");

  const payloadTest8: IntelligenceReportPayload = {
    ...basePayload,
    hypothesisLifecycle: hypothesis,
    evidenceRegistry: [evContextual]
  };

  try {
    ReportQualityGate.validate(payloadTest8, briefingDummy);
    console.log("✅ TEST 8 PASADO: Evidencia de contexto sin hipótesis asociada pasa de forma exitosa sin bloqueos.");
  } catch (err: any) {
    console.error("❌ TEST 8 FALLÓ:", err.message);
  }
}

runEGETests();
