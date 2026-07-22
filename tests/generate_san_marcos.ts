import * as fs from "fs";
import * as path from "path";

// 1. STUB DOM FOR REPORT ENGINE
if (typeof global.document === "undefined") {
  const mockCanvasContext = new Proxy({}, {
    get: (target, prop) => {
      if (prop === "measureText") {
        return () => ({ width: 10 });
      }
      if (prop === "getImageData" || prop === "createImageData") {
        return () => ({ data: new Uint8ClampedArray(4) });
      }
      return () => {};
    }
  });
  const mockCanvas = {
    getContext: () => mockCanvasContext,
    width: 100,
    height: 100,
    toDataURL: () => "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    toBlob: (callback: any) => {
      const mockBlob = {
        arrayBuffer: async () => Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64")
      };
      if (callback) callback(mockBlob);
    }
  };
  (global as any).document = {
    createElement: (tag: string) => {
      if (tag === "canvas") {
        return mockCanvas;
      }
      return {};
    },
    getElementById: () => null,
  };

  (global as any).Image = class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    src: string = "";
    constructor() {
      setTimeout(() => {
        if (this.onload) this.onload();
      }, 0);
    }
  };
}

// 2. MOCK FILE-SAVER TO SAVE TO THE SCRATCH DIRECTORY
const fileSaver = require("file-saver");
fileSaver.saveAs = (blob: any, filename: string) => {
  console.log(`[Intercept] Intercepted blob for: ${filename}`);
  blob.arrayBuffer().then((buf: ArrayBuffer) => {
    const buffer = Buffer.from(buf);
    const destDir = path.join(__dirname, "..", "scratch");
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    const dest = path.join(destDir, filename);
    fs.writeFileSync(dest, buffer);
    console.log(`\n======================================================================`);
    console.log(`🎉 INFORME EXPORTADO EXITOSAMENTE`);
    console.log(`Archivo: ${dest}`);
    console.log(`Tamaño: ${buffer.length} bytes`);
    console.log(`======================================================================\n`);
  });
};

import { exportToWord } from "../src/lib/exportToWord";

async function generateTestReport() {
  console.log("======================================================================");
  console.log("🧪 INICIANDO COMPILACIÓN DE PRUEBA: HACIENDA_SAN_MARCOS_INDIVI");
  console.log("======================================================================");

  // Payload completo con evidencia (Para verificar preservación de análisis, mapas y tablas lineales)
  const payloadWithEvidence = {
    projectName: "HACIENDA_SAN_MARCOS_INDIVI",
    date: "22/07/2026",
    analyst: "Analista de Operaciones CEIPOL",
    lat: 21.8542,
    lng: -102.2891,
    
    // Contrato de Integración de Inteligencia (IIC) obligatorio para evitar MIGRATION_BLOCKAGE
    intelligenceContext: {
      projectId: "HACIENDA_SAN_MARCOS_INDIVI",
      analysisReadiness: "READY",
      evidenceSources: {
        ACE: {
          globalStatus: "PASS",
          overallConfidence: 95,
          alerts: []
        }
      },
      qualityControl: {
        status: "PASS"
      }
    },

    // Capítulo 0: Trayectoria de la Hipótesis
    hypothesisLifecycle: {
      hipotesisInicial: "La penumbra vial en el sector de Hacienda San Marcos atrae el robo con violencia.",
      hipotesisActual: "Se confirma la relación directa entre la carencia de alumbrado y el índice delictivo local.",
      preguntaInicial: "¿Cómo influye la oscuridad en los robos de Hacienda San Marcos?",
      evidenciaIncorporada: ["EV-01: Alumbrado defectuoso", "EV-02: Maleza alta en baldío"],
      evolucionHipotesis: "Se observó un incremento de la actividad en las horas de penumbra.",
      estadoFinal: "Se requiere intervención vial."
    },

    // Síntesis Ejecutiva
    executiveSummaryReport: {
      isValid: true,
      situation: "Se identificó un patrón recurrente de robo violento facilitado por la vulnerabilidad física del entorno urbano en el sector.",
      primaryFindings: [
        { title: "Zonas de Penumbra Crítica", finding: "Inoperatividad del 60% del alumbrado en el eje Paseos del Sur." }
      ],
      hypothesisState: {
        state: "CONFIRMADA",
        confidenceScore: 92,
        statement: "La penumbra vial de Hacienda San Marcos atrae la comisión de ilícitos patrimoniales bajo amparo de la oscuridad."
      },
      recommendations: [
        { action: "Sustitución de luminarias", objective: "Reducir el índice de robo peatonal táctico." }
      ],
      supportingFindings: []
    },

    // Conclusiones requeridas por la Puerta de Certificación y el renderizado
    conclusionesText: "Se concluye que la zona de Hacienda San Marcos requiere un reforzamiento inmediato de patrullaje preventivo y la restitución del servicio de alumbrado público.",
    conclusiones: {
      hallazgosCriticos: ["Falta de iluminación en el 60% del eje vial"],
      recomendacionesTacticas: ["Operativo penumbra preventivo"],
      recomendacionesEstrategicas: ["Sustitución tecnológica de luminarias"],
      escenariosFuturos: ["Escenario de remediación del servicio de alumbrado público."],
      lineasAccion: ["Operativos coordinados preventivos en horario nocturno."]
    },

    // Capítulo 7: OSINT / DENUE Sweeps
    sweepsData: [
      {
        engine: "DENUE",
        source: "INEGI",
        data: "Nombre: Mini Súper El Paso, Giro: Comercio al por menor, Dirección: Calle Paseos del Sur 102, Distancia: 45 metros",
        context: "Relevancia: Alta. Interpretación: Punto de afluencia de personas que funciona como atractor de oportunidad."
      },
      {
        engine: "DENUE",
        source: "INEGI",
        data: "Nombre: Cantina Guadalupana, Giro: Servicios de alimentos y bebidas, Dirección: Calle Paseos del Sur 204, Distancia: 80 metros",
        context: "Relevancia: Media. Interpretación: Genera concentración de personas en horario nocturno."
      }
    ],

    // Evidencia física para evitar la especulación y preservar los análisis
    photoEvidence: [
      {
        id: "EV-01",
        previewUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        lat: 21.8542,
        lng: -102.2891,
        tipo: "ALUMBRADO_PUBLICO",
        comentario: "Poste de alumbrado inoperativo generando zona de penumbra táctica.",
        createdAt: "2026-07-22T10:15:00Z",
        capturedBy: "analista_campo_1"
      },
      {
        id: "EV-02",
        previewUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        lat: 21.8546,
        lng: -102.2895,
        tipo: "VULNERABILIDAD_FISICA",
        comentario: "Terreno baldío abierto con acumulación de maleza y escombros.",
        createdAt: "2026-07-22T10:18:00Z",
        capturedBy: "analista_campo_1"
      }
    ],

    streetViewAnalysis: [
      {
        id: "SV-01",
        dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5OrkJggg==",
        observed: "Se observa el baldío con maleza crecida desde la perspectiva de la calle principal.",
        confidence: 95
      },
      {
        id: "SV-02",
        dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5OrkJggg==",
        observed: "Perspectiva de la vialidad principal sin presencia de luminarias secundarias activas.",
        confidence: 90
      }
    ],

    // Soft Governance Certification
    includeAnnex: true,
    includeOsintAppendix: true,
    aceReport: {
      globalStatus: "PASS",
      overallConfidence: 95,
      alerts: []
    }
  };

  await exportToWord(payloadWithEvidence, "HACIENDA_SAN_MARCOS_INDIVI", "EXP-2026-SM-001");
}

generateTestReport();
