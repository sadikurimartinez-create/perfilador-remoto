import { HypothesisLifecycleManager, InvestigationHypothesis } from "../src/utils/hypothesisLifecycle";
import { ReportQualityGate } from "../src/utils/reportQualityGate";
import { IntelligenceReportPayload, IntelligenceBriefing } from "../src/utils/intelligenceLayoutEngine";

// Base payload para pasar las validaciones estructurales básicas de ReportQualityGate
const basePayload: IntelligenceReportPayload = {
  projectName: "Test HLIE",
  projectId: "lALwSyWz0PGiMyJE1GMr",
  date: "16/07/2026",
  analyst: "Analista Táctico",
  geometryType: "Polígono",
  areaGeografica: "Centro",
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

function runHypothesisTests() {
  console.log("=== INICIANDO SUITE DE PRUEBAS ADR-011 (HLIE) ===");

  // ==========================================
  // TEST 1: Hipótesis inicial creada
  // ==========================================
  console.log("\n[TEST 1] Creando hipótesis inicial...");
  let hypothesis = HypothesisLifecycleManager.create(
    "lALwSyWz0PGiMyJE1GMr",
    "Determinar si existe vulnerabilidad urbana en el sector norte que favorezca robos."
  );
  // Transicionamos a EN_ANALISIS para registrar un evento de evolución inicial, lo que nos permite conservar conclusiones tácticas de calidad en Capítulo 10 sin disparar BLOQUEO 2.
  hypothesis = HypothesisLifecycleManager.transition(
    hypothesis,
    "EN_ANALISIS",
    "AMPLIACION",
    [],
    "Se inicia el análisis de vulnerabilidad urbana en terreno."
  );

  const payloadTest1: IntelligenceReportPayload = {
    ...basePayload,
    hypothesisLifecycle: hypothesis
  };

  try {
    ReportQualityGate.validate(payloadTest1, briefingDummy);
    console.log("✅ TEST 1 PASADO: Hipótesis inicial creada y validada (Estatus: EN_ANALISIS).");
  } catch (err: any) {
    console.error("❌ TEST 1 FALLÓ:", err.message);
  }

  // ==========================================
  // TEST 2: Hipótesis modificada después de nueva evidencia
  // ==========================================
  console.log("\n[TEST 2] Modificando hipótesis por evidencia...");
  hypothesis = HypothesisLifecycleManager.transition(
    hypothesis,
    "MODIFICADA",
    "AMPLIACION",
    ["photo-sv-1", "sie-historical-1"],
    "La evidencia valida vulnerabilidad por baldíos y baja iluminación, ampliando el foco a robo patrimonial recurrente.",
    "Analista",
    "Analista Responsable"
  );

  const payloadTest2: IntelligenceReportPayload = {
    ...basePayload,
    hypothesisLifecycle: hypothesis
  };

  try {
    ReportQualityGate.validate(payloadTest2, briefingDummy);
    console.log("✅ TEST 2 PASADO: Hipótesis modificada con evidencia e historial registrado.");
  } catch (err: any) {
    console.error("❌ TEST 2 FALLÓ:", err.message);
  }

  // ==========================================
  // TEST 3: Hipótesis confirmada con evidencia
  // ==========================================
  console.log("\n[TEST 3] Confirmando hipótesis con evidencia...");
  let hypothesisConfirmed = HypothesisLifecycleManager.create(
    "lALwSyWz0PGiMyJE1GMr",
    "Vulnerabilidad ambiental propicia robos."
  );
  hypothesisConfirmed = HypothesisLifecycleManager.transition(
    hypothesisConfirmed,
    "CONFIRMADA",
    "CONFIRMACION",
    ["photo-01", "photo-02"],
    "Se confirma la correlación entre luminarias apagadas y asaltos nocturnos."
  );

  const payloadTest3: IntelligenceReportPayload = {
    ...basePayload,
    hypothesisLifecycle: hypothesisConfirmed
  };

  try {
    ReportQualityGate.validate(payloadTest3, briefingDummy);
    console.log("✅ TEST 3 PASADO: Hipótesis confirmada con evidencia empírica vinculada.");
  } catch (err: any) {
    console.error("❌ TEST 3 FALLÓ:", err.message);
  }

  // ==========================================
  // TEST 4: Conclusión sin evolución documentada
  // ==========================================
  console.log("\n[TEST 4] Evaluando bloqueo si hay conclusiones pero no hay evolución...");
  const hypothesisNoHistory = HypothesisLifecycleManager.create(
    "lALwSyWz0PGiMyJE1GMr",
    "Robo patrimonial bajo análisis."
  );
  // No transicionamos, por lo que historialEvolucion es [] pero payload tiene conclusiones.
  const payloadTest4: IntelligenceReportPayload = {
    ...basePayload,
    hypothesisLifecycle: hypothesisNoHistory
  };

  try {
    ReportQualityGate.validate(payloadTest4, briefingDummy);
    console.error("❌ TEST 4 FALLÓ: Debió haber bloqueado debido a falta de historial.");
  } catch (err: any) {
    if (err.message.includes("[QUALITY GATE HLIE - BLOQUEO 2]")) {
      console.log("✅ TEST 4 PASADO (Bloqueo exitoso):", err.message);
    } else {
      console.error("❌ TEST 4 FALLÓ con otro error:", err.message);
    }
  }

  // ==========================================
  // TEST 5: Fenómeno confirmado sin evidencia suficiente
  // ==========================================
  console.log("\n[TEST 5] Evaluando bloqueo si estado actual es FENOMENO_CONFIRMADO sin evidencia...");
  let hypothesisNoEvidence = HypothesisLifecycleManager.create(
    "lALwSyWz0PGiMyJE1GMr",
    "Vulnerabilidad territorial."
  );
  // Forzamos estado a FENOMENO_CONFIRMADO pero con evidencia vacía
  hypothesisNoEvidence.estadoActual = "FENOMENO_CONFIRMADO";
  hypothesisNoEvidence.evidenciaConfirmatoria = [];
  hypothesisNoEvidence.historialEvolucion = [
    {
      fecha: Date.now(),
      estadoAnterior: "INICIAL",
      estadoNuevo: "FENOMENO_CONFIRMADO",
      tipoCambio: "CONFIRMACION",
      evidenciaRelacionada: [],
      justificacionAnalitica: "Confirmación sin adjuntar evidencia.",
      motorQueGeneroCambio: "Analista",
      usuarioResponsable: "Analista Responsable"
    }
  ];

  const payloadTest5: IntelligenceReportPayload = {
    ...basePayload,
    hypothesisLifecycle: hypothesisNoEvidence
  };

  try {
    ReportQualityGate.validate(payloadTest5, briefingDummy);
    console.error("❌ TEST 5 FALLÓ: Debió haber bloqueado por falta de evidencia.");
  } catch (err: any) {
    if (err.message.includes("[QUALITY GATE HLIE - BLOQUEO 3]")) {
      console.log("✅ TEST 5 PASADO (Bloqueo exitoso):", err.message);
    } else {
      console.error("❌ TEST 5 FALLÓ con otro error:", err.message);
    }
  }

  // ==========================================
  // TEST 6: Pérdida de hipótesis inicial
  // ==========================================
  console.log("\n[TEST 6] Evaluando pérdida de hipótesis inicial...");
  const hypothesisLost: any = {
    id: "lost-1",
    expedienteId: "lALwSyWz0PGiMyJE1GMr",
    hipotesisInicial: "", // VACÍO - INCUMPLIMIENTO
    hipotesisActual: "Cambio total de escenario",
    estadoActual: "MODIFICADA",
    historialEvolucion: []
  };

  const payloadTest6: IntelligenceReportPayload = {
    ...basePayload,
    hypothesisLifecycle: hypothesisLost
  };

  try {
    ReportQualityGate.validate(payloadTest6, briefingDummy);
    console.error("❌ TEST 6 FALLÓ: Debió haber bloqueado por hipótesis inicial vacía.");
  } catch (err: any) {
    if (err.message.includes("[QUALITY GATE HLIE - BLOQUEO 1]")) {
      console.log("✅ TEST 6 PASADO (Bloqueo exitoso):", err.message);
    } else {
      console.error("❌ TEST 6 FALLÓ con otro error:", err.message);
    }
  }

  // ==========================================
  // TEST 7: Salto epistemológico no documentado
  // ==========================================
  console.log("\n[TEST 7] Evaluando salto epistemológico sin justificación intermedia...");
  let hypothesisEpistemicJump = HypothesisLifecycleManager.create(
    "lALwSyWz0PGiMyJE1GMr",
    "Evaluar la vulnerabilidad urbana por lote baldío y maleza."
  );
  // Cambiamos el estado a MODIFICADA pero sin registrar evento intermedio REORIENTACION / AMPLIACION
  hypothesisEpistemicJump.estadoActual = "MODIFICADA";
  hypothesisEpistemicJump.historialEvolucion = [
    {
      fecha: Date.now(),
      estadoAnterior: "INICIAL",
      estadoNuevo: "MODIFICADA",
      tipoCambio: "CONFIRMACION", // No es REORIENTACION ni AMPLIACION
      evidenciaRelacionada: ["photo-01"],
      justificacionAnalitica: "Solo confirmamos que hay maleza.",
      motorQueGeneroCambio: "Analista",
      usuarioResponsable: "Analista Responsable"
    }
  ];

  const payloadTest7: IntelligenceReportPayload = {
    ...basePayload,
    hypothesisLifecycle: hypothesisEpistemicJump,
    finalHypothesis: `
      [HECHO OBSERVADO] Se concluye presencia de célula criminal confirmada del cártel.
      [EVIDENCIA UTILIZADA] Registros de campo.
      [INFERENCIA ANALÍTICA] Operación de cartel.
      [NIVEL DE CONFIANZA] Nivel de confianza: ALTO.
      [IMPLICACIÓN OPERACIONAL] Despliegue operativo táctico de asalto.
    `
  };

  try {
    ReportQualityGate.validate(payloadTest7, briefingDummy);
    console.error("❌ TEST 7 FALLÓ: Debió haber bloqueado el salto epistemológico de vulnerabilidad urbana -> célula criminal.");
  } catch (err: any) {
    if (err.message.includes("[QUALITY GATE HLIE - BLOQUEO 5]")) {
      console.log("✅ TEST 7 PASADO (Bloqueo de salto epistemológico exitoso):", err.message);
    } else {
      console.error("❌ TEST 7 FALLÓ con otro error:", err.message);
    }
  }
}

runHypothesisTests();
