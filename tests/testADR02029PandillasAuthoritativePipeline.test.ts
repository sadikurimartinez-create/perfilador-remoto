import { POST } from "../src/app/api/pandillas/route";
import { POST as POST_GIS } from "../src/app/api/pandillas/analyze-gis/route";
import { fuseGangsAndBuildGraph, matchPandillasDatasetRows } from "../src/modules/pandillas/pandillas.fusion";
import { GangEntity } from "../src/modules/pandillas/pandillas.mapper";
import { GangGeoSweepEngine } from "../src/lib/providers/gangGeoSweepEngine";
import { GangIntelligenceEngine } from "../src/utils/gangIntelligenceEngine/gangIntelligenceEngine";
import { GimToAceAdapter } from "../src/utils/gangIntelligenceEngine/adapters/gimToAceAdapter";
import { AnalyticalConsistencyEngine } from "../src/utils/analyticalConsistencyEngine/analyticalConsistencyEngine";
import { ACEPayload } from "../src/utils/analyticalConsistencyEngine/models/aceTypes";
import { PredictionService } from "../src/modules/pandillas/services/predictionService";
import exifr from "exifr";

jest.mock("@/lib/geminiEnv", () => ({
  GCP_PROJECT_ID: "test",
  GCP_LOCATION: "us-central1",
  GEMINI_MODEL: "gemini-test",
  GCP_CLIENT_EMAIL: "",
  GCP_PRIVATE_KEY: "",
}));

jest.mock("@google-cloud/vertexai", () => ({ VertexAI: jest.fn() }));

jest.mock("exifr", () => ({
  __esModule: true,
  default: { gps: jest.fn() },
}));

const mockCorrelate = jest.fn((input) => ({ input }));

jest.mock("@/lib/geoint/geoIntAnalyticsEngine", () => ({
  GeoIntAnalyticsEngine: {
    analyze: jest.fn(async () => ({
      report: "ok",
      structuredOutput: {},
      isAiGenerated: false,
    })),
  },
}));

jest.mock("@/lib/criminal/correlation/criminalCorrelationEngine", () => ({
  CriminalIntelligenceCorrelationEngine: {
    correlate: (input: any) => mockCorrelate(input),
  },
}));

const mockSem: any = {
  metadata: {
    projectId: "EXP-ADR-020-29",
    totalCanonicalIncidents: 10,
    analysisRadiusMeters: 1000,
    centerLat: 21.80929,
    centerLng: -102.26964
  },
  criminalEvidence: { totalEvents: 10, crimeTypes: [], dominantCrime: "ROBO", concentrationScore: 1 },
  temporalEvidence: { temporalCoverage: { startDate: "2025-01-01", endDate: "2025-12-31" } },
  spatialEvidence: {
    hotspots: [{ id: "h1", center: { lat: 21.80929, lng: -102.26964 }, events: 10, densityScore: 0.8 }],
    centerOfGravity: { lat: 21.80929, lng: -102.26964 },
    spatialPattern: "CONCENTRACIÓN ESPACIAL",
  },
  predictiveEvidence: { confidenceMetrics: { statisticalConfidence: 95, operationalReliability: 95 } },
  qualityEvidence: { dataCompleteness: 100, statisticalValidity: true, warnings: [], validationStatus: "VALIDATED" },
  limitations: [],
};

function baseAcePayload(gimContext: any, projectId = "EXP-ADR-020-29"): ACEPayload {
  return {
    projectId,
    tceContext: {
      centroid: { lat: 21.80929, lng: -102.26964 },
      radiusMeters: 1000,
      startDate: "2025-01-01",
      endDate: "2025-12-31"
    },
    sieEventsCount: 10,
    semContext: mockSem,
    cieContext: {
      centroid: { lat: 21.80929, lng: -102.26964 },
      radiusMeters: 1000,
      eventsCount: 10,
      hotspotsCount: 1
    },
    hieContext: {
      validationVector: {
        spatialPattern: "CONCENTRATED",
        temporalPattern: "STABLE",
        criticalOpportunity: "MEDIUM"
      }
    },
    reportContext: {
      mapCount: 1,
      chartsCount: 1,
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      eventsCount: 10
    },
    gimContext
  };
}

function authoritativeGim(overrides: any = {}) {
  return {
    confidenceScore: 90,
    limitationsCount: 0,
    hasTraceability: true,
    sourceIntegrityStatus: "VERIFIED",
    authorityClassification: "AUTHORITATIVE",
    nonAuthoritativeSourcesCount: 0,
    humanValidationStatus: "APPROVED",
    validatedByUserId: "real-user-123",
    humanValidatedAt: "2026-08-30T12:00:00.000Z",
    contradictoryEvidenceCount: 0,
    evidenceCount: { graffiti: 2, osintEvents: 1 },
    evidenceDescriptions: ["Grafiti con simbología asociada: Número 13"],
    analyticalObservations: ["Influencia de tipo SYMBOLIC con nivel de actividad MEDIUM"],
    lineage: {
      evidenceIds: ["evidence-1"],
      findingIds: ["finding-1"],
      analysisIds: ["analysis-1"],
      providerProvenance: ["VEE_GRAFFITI"]
    },
    ...overrides
  };
}

describe("ADR-020.29 Pandillas authoritative pipeline", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test("TEST 001 - no match in local dataset returns empty list, not first N rows", () => {
    const rows = Array.from({ length: 25 }, (_, idx) => ({
      Pandilla: `Grupo ${idx}`,
      Colonia: `Colonia ${idx}`,
      Calle: `Calle ${idx}`,
    }));

    expect(matchPandillasDatasetRows(rows, "No existe", "Zona inexistente")).toEqual([]);
  });

  test("TEST 002 - matching dataset rows are preserved when a real upstream match exists", () => {
    const rows = [
      { Pandilla: "Clica Norte", Colonia: "Centro", Calle: "Uno" },
      { Pandilla: "Otra", Colonia: "Sur", Calle: "Dos" },
    ];

    expect(matchPandillasDatasetRows(rows, "Clica Norte", "")).toEqual([rows[0]]);
  });

  test("TEST 003 - deterministic fusion skips CSV rows without source coordinates", () => {
    const result = fuseGangsAndBuildGraph(
      { nombre: "Clica Norte", zonaInfluencia: "Centro", estatus: "Activa", integrantes: [] },
      [],
      [{ Calle: "Uno", No: "1", Colonia: "Centro", Municipio: "Aguascalientes", Estado: "Aguascalientes" }]
    );

    expect(result.mapa.geolocalizacion).toEqual([]);
    expect(result.mapa.areasCalientes).toEqual([]);
  });

  test("TEST 004 - deterministic fusion preserves real source coordinates without synthetic offsets", () => {
    const result = fuseGangsAndBuildGraph(
      { nombre: "Clica Norte", zonaInfluencia: "Centro", estatus: "Activa", integrantes: [] },
      [],
      [{ Calle: "Uno", No: "1", Colonia: "Centro", Municipio: "Aguascalientes", Estado: "Aguascalientes", Lat: 21.81, Lng: -102.27 }]
    );

    expect(result.mapa.geolocalizacion[0]).toMatchObject({ lat: 21.81, lng: -102.27 });
    expect(result.mapa.areasCalientes[0]).toMatchObject({ lat: 21.81, lng: -102.27, radioMetros: 0, intensidad: 0 });
  });

  test("TEST 005 - GangGeoSweepEngine does not create narrative or fallback random coordinates", async () => {
    const result = await GangGeoSweepEngine.executeSweep([], "mirador clica", "zona centro", []);

    expect(result.detected_locations).toEqual([]);
    expect(result.matched_gangs).toEqual([]);
    expect(result.geo_heatmap).toEqual([]);
  });

  test("TEST 006 - SOURCE_RECORD matches are not promoted to current GEOINT observations", async () => {
    const result = await GangGeoSweepEngine.executeSweep([], "clica norte", "", [
      {
        nombre: "Clica Norte",
        geometrias: [{ puntos: [{ lat: 21.812, lng: -102.271 }] }]
      }
    ]);

    expect(result.detected_locations).toEqual([]);
    expect(result.suspected_domiciles).toEqual([]);
    expect(result.influence_zones).toEqual([]);
    expect(result.geo_heatmap).toEqual([]);
    expect(result.matched_gangs).toEqual([]);
    expect(result.confidence_score).toBe(0);
  });

  test("TEST 006A - authorized EXIF GPS is promoted to a current GEOINT observation", async () => {
    jest.mocked(exifr.gps).mockResolvedValueOnce({
      latitude: 21.812,
      longitude: -102.271,
    });
    const authorizedPhoto = { name: "authorized-current-sweep.jpg" } as File;

    const result = await GangGeoSweepEngine.executeSweep([authorizedPhoto], "", "", []);

    expect(result.detected_locations).toHaveLength(1);
    expect(result.detected_locations[0]).toMatchObject({
      lat: 21.812,
      lng: -102.271,
      source: "EXIF_GPS",
      authority: "AUTHORITATIVE",
    });
  });

  test("TEST 007 - high AI/GIM score remains READY_FOR_HUMAN_REVIEW and not APPROVED", () => {
    const report = AnalyticalConsistencyEngine.audit(baseAcePayload(authoritativeGim({
      humanValidationStatus: "READY_FOR_HUMAN_REVIEW"
    })), "EXPORT");

    expect(report.globalStatus).toBe("FAILED");
    expect(report.certifiedGimOutput?.validationStatus).toBe("NOT_CERTIFIED");
    expect(report.certifiedGimOutput?.humanValidationStatus).toBe("READY_FOR_HUMAN_REVIEW");
  });

  test("TEST 008 - human approval persists into CertifiedGangAnalysisPayload", () => {
    const report = AnalyticalConsistencyEngine.audit(baseAcePayload(authoritativeGim()), "EXPORT");

    expect(report.globalStatus).toBe("PASS");
    expect(report.certifiedGimOutput?.validationStatus).toBe("CERTIFIED");
    expect(report.certifiedGimOutput?.humanValidationStatus).toBe("APPROVED");
  });

  test("TEST 009 - subsequent read can recover APPROVED from persisted payload shape", () => {
    const report = AnalyticalConsistencyEngine.audit(baseAcePayload(authoritativeGim()), "EXPORT");
    const persisted = JSON.parse(JSON.stringify(report.certifiedGimOutput));

    expect(persisted.humanValidationStatus).toBe("APPROVED");
    expect(persisted.validationStatus).toBe("CERTIFIED");
  });

  test("TEST 010 - real validator identity and timestamp are conserved", () => {
    const report = AnalyticalConsistencyEngine.audit(baseAcePayload(authoritativeGim()), "EXPORT");

    expect(report.certifiedGimOutput?.validatedByUserId).toBe("real-user-123");
    expect(report.certifiedGimOutput?.humanValidatedAt).toBe("2026-08-30T12:00:00.000Z");
  });

  test("TEST 011 - missing validator identity is not fabricated", () => {
    const report = AnalyticalConsistencyEngine.audit(baseAcePayload(authoritativeGim({
      validatedByUserId: null,
      humanValidatedAt: null
    })), "EXPORT");

    expect(report.certifiedGimOutput?.validatedByUserId).toBeNull();
    expect(report.certifiedGimOutput?.humanValidatedAt).toBeNull();
  });

  test("TEST 012 - simulated source blocks certified payload", () => {
    const report = AnalyticalConsistencyEngine.audit(baseAcePayload(authoritativeGim({
      authorityClassification: "NON_AUTHORITATIVE",
      nonAuthoritativeSourcesCount: 1,
    })), "EXPORT");

    expect(report.globalStatus).toBe("FAILED");
    expect(report.certifiedGimOutput?.validationStatus).toBe("NOT_CERTIFIED");
  });

  test("TEST 013 - source integrity NOT_READY blocks certified payload", () => {
    const report = AnalyticalConsistencyEngine.audit(baseAcePayload(authoritativeGim({
      sourceIntegrityStatus: "NOT_READY",
    })), "EXPORT");

    expect(report.globalStatus).toBe("FAILED");
    expect(report.certifiedGimOutput?.validationStatus).toBe("NOT_CERTIFIED");
  });

  test("TEST 014 - lineage evidence ids are preserved end-to-end", () => {
    const report = AnalyticalConsistencyEngine.audit(baseAcePayload(authoritativeGim()), "EXPORT");

    expect(report.certifiedGimOutput?.lineage?.evidenceIds).toEqual(["evidence-1"]);
    expect(report.certifiedGimOutput?.lineage?.providerProvenance).toEqual(["VEE_GRAFFITI"]);
  });

  test("TEST 015 - legacy GIM without ADR-020.29 fields is not retrospectively certified", () => {
    const report = AnalyticalConsistencyEngine.audit(baseAcePayload({
      confidenceScore: 90,
      limitationsCount: 0,
      hasTraceability: true,
      contradictoryEvidenceCount: 0,
      evidenceCount: { graffiti: 2, osintEvents: 1 },
      evidenceDescriptions: ["Grafiti con simbología asociada"],
      analyticalObservations: ["Influencia simbólica"]
    }), "EXPORT");

    expect(report.certifiedGimOutput?.validationStatus).toBe("NOT_CERTIFIED");
  });

  test("TEST 016 - GIM bridge records HASH_UNAVAILABLE instead of fake hash when no upstream hash exists", () => {
    const gem = GangIntelligenceEngine.buildGangIntelligence({
      projectId: "EXP-ADR-020-29",
      projectLat: 21.81,
      projectLng: -102.27,
      rawOsintFeeds: [],
      veeGraffitiFeeds: [{
        image: "data:",
        title: "Tag 13",
        description: "Pinta observada",
        finding: "Simbología 13",
        operationalImpact: "Revisión"
      }],
      humanValidationStatus: "READY_FOR_HUMAN_REVIEW"
    });

    expect(gem.traceabilityLog[0].sourceIntegrityStatus).toBe("HASH_UNAVAILABLE");
    expect(gem.metadata.validatedByUserId).toBeNull();
  });

  test("TEST 017 - prediction service remains diagnostic and cannot certify payload", async () => {
    const prediction = await new PredictionService().calculateRisk("gang-1");

    expect(prediction.confidence).toBeLessThan(1);
    expect((prediction as any).validationStatus).toBeUndefined();
    expect((prediction as any).certifiedGimOutput).toBeUndefined();
  });

  test("TEST 018 - POST path overwrites AI generated geolocation with empty source coordinates when there is no upstream coordinate", async () => {
    const originalFetch = global.fetch;
    process.env.GEMINI_API_KEY = "test-key";
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify({ mapa: { geolocalizacion: [{ lat: 21.88, lng: -102.29 }], areasCalientes: [{ lat: 21.88, lng: -102.29 }] } }) }]
          }
        }]
      })
    } as any));

    const response = await POST(new Request("http://localhost/api/pandillas", {
      method: "POST",
      body: JSON.stringify({ nombre: "Sin Match", zonaInfluencia: "No Existe", integrantes: [] })
    }));
    const body = await response.json();
    global.fetch = originalFetch;

    expect(body.mapa.geolocalizacion).toEqual([]);
    expect(body.mapa.areasCalientes).toEqual([]);
    expect(body.sourceIntegrity.geolocationPolicy).toBe("GEO_UNAVAILABLE");
  });

  test("TEST 019 - CICE telemetry does not hardcode provider availability", async () => {
    const response = await POST_GIS(new Request("http://localhost/api/pandillas/analyze-gis", {
      method: "POST",
      body: JSON.stringify({
        selectedGangs: ["Clica Norte"],
        activeLayers: ["osint", "influence"],
        domiciles: [],
        influenceZones: [],
        manualDrawings: [],
        allGangs: []
      })
    }));
    const body = await response.json();

    expect(body.structuredOutput.cice_report.input).toMatchObject({
      rssCount: 0,
      hasGoogleMaps: false,
      hasScince: false,
      hasDenue: false,
      socialMediaSignals: {
        telegram: false,
        facebook: false,
        instagram: false,
        x: false,
        reddit: false,
        search: false,
      }
    });
  });
});
