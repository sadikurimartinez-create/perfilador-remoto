jest.mock("@/lib/osintActions", () => ({
  getScinceData: jest.fn(async () => ({
    exito: true,
    poblacionTotal: 100,
    viviendasTotales: 40,
    gradoMarginacion: "N/D",
    epistemicIntegrity: {
      sourceId: "SCINCE_LOCAL_SIMULATOR",
      providerId: "SCINCE_LOCAL_SIMULATOR",
      sourceType: "SCINCE",
      acquisitionMode: "SIMULATED",
      acquisitionStatus: "ACQUIRED",
      semanticRole: "DIAGNOSTIC",
      isSimulated: true,
    },
  })),
  getDenueData: jest.fn(async () => ({
    exito: true,
    total: 1,
    resumen: "Negocio real",
    epistemicIntegrity: {
      sourceId: "inegi-denue-api",
      providerId: "INEGI_DENUE",
      sourceType: "DENUE",
      acquisitionMode: "OBSERVED",
      acquisitionStatus: "ACQUIRED",
      semanticRole: "SOURCE_FACT",
    },
  })),
  getTelegramOsintData: jest.fn(async () => ({
    success: true,
    osintSummary: "Síntesis derivada",
    epistemicIntegrity: {
      sourceId: "telegram-gemini-osint-synthesis",
      providerId: "GEMINI",
      providerName: "Google Vertex AI Gemini",
      sourceType: "TELEGRAM_CONTEXT",
      acquisitionMode: "AI_GENERATED",
      acquisitionStatus: "ACQUIRED",
      semanticRole: "SYNTHESIS",
      sourceReference: "src/lib/osintActions.ts:getTelegramOsintData",
      rawSourceReference: "gemini:generateContent:telegram-context-synthesis",
    },
  })),
}));

jest.mock("@/modules/pandillas/pandillas.service", () => ({
  PandillasService: {
    analyzeGang: jest.fn(async () => ({
      exito: true,
      razon: "ok",
      elementosFusionados: [],
      resumenEjecutivo: "ok",
      scoreRiesgo: 0,
      accionesSugeridas: [],
      origenDatos: "TEST",
      isAiGenerated: true,
    })),
  },
}));

import { PandillasEngine } from "@/modules/pandillas/pandillas.engine";

describe("ADR-021.4D-3C-1 Pandillas OSINT productive wiring", () => {
  it("adds Gemini Telegram synthesis to orchestration as derived limited source", async () => {
    const result = await PandillasEngine.executeFullSweep(
      {
        id: "gang-1",
        projectId: "exp-1",
        nombre: "Pandilla Test",
        zonaInfluencia: "Zona Test",
        coordenadas: { lat: 21.88, lng: -102.29 },
      } as any,
      "contexto"
    );

    expect(result.externalSourceProvenance).toHaveLength(3);
    expect(result.sourceOrchestrationItems).toHaveLength(3);

    const telegramItem = result.sourceOrchestrationItems?.find(
      (item: any) => item.source.sourceType === "TELEGRAM_CONTEXT"
    );

    expect(telegramItem).toBeDefined();
    expect(telegramItem?.source.authorityClassification).toBe("NON_AUTHORITATIVE");
    expect(telegramItem?.source.integrityClassification).toBe("READY_WITH_LIMITATIONS");
    expect(telegramItem?.eligibility).toBe("LIMITED");
    expect((telegramItem as any)?.dependencyClassification).toBe("DERIVED");
    expect(telegramItem?.evidenceRef).toBeUndefined();
    expect(telegramItem?.findingRef).toBeUndefined();
  });
});
