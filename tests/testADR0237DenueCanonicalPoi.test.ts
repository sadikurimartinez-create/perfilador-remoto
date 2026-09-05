import { buildCanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import {
  canonicalizeDenuePoisForInstitutionalAnalysis,
  prepareDenueAcquisitionPois,
} from "../src/utils/denueCanonicalPoi";
import { TerritorialIntelligenceEngine } from "../src/utils/territorialIntelligenceEngine";

const center = { lat: 21.8818, lng: -102.2916 };

function pointGeography() {
  return buildCanonicalProjectGeography({
    projectId: "exp-denue-1",
    type: "INDIVIDUAL",
    points: [center],
    geographyId: "geo-exp-denue-1-individual",
    now: 1,
  });
}

function denueRaw(overrides: Record<string, any> = {}) {
  return {
    Id: "010010001234",
    CLEE: "CLEE010010001234",
    Nombre: "Abarrotes Observados",
    Clase_actividad: "Comercio al por menor en tiendas de abarrotes",
    Domicilio: "Calle Observada 100",
    Latitud: "21.88182",
    Longitud: "-102.29163",
    ...overrides,
  };
}

describe("ADR-023.7 DENUE canonical POI hardening", () => {
  test("valid real DENUE POI is OBSERVED SOURCE_FACT and never simulated", () => {
    const result = canonicalizeDenuePoisForInstitutionalAnalysis([denueRaw()], {
      expedienteId: "exp-denue-1",
      canonicalGeography: pointGeography(),
      radiusMeters: 250,
    });

    expect(result.institutionalPois).toHaveLength(1);
    expect(result.institutionalPois[0].epistemicIntegrity.acquisitionMode).toBe("OBSERVED");
    expect(result.institutionalPois[0].epistemicIntegrity.semanticRole).toBe("SOURCE_FACT");
    expect(result.institutionalPois[0].epistemicIntegrity.isSimulated).toBe(false);
    expect(result.institutionalPois[0].epistemicIntegrity.isConnectivityOnly).toBe(false);
  });

  test("valid DENUE POI receives expediente geographyId from canonical geography", () => {
    const result = canonicalizeDenuePoisForInstitutionalAnalysis([denueRaw()], {
      expedienteId: "exp-denue-1",
      canonicalGeography: pointGeography(),
      radiusMeters: 250,
    });

    expect(result.institutionalPois[0].expedienteId).toBe("exp-denue-1");
    expect(result.institutionalPois[0].geographyId).toBe("geo-exp-denue-1-individual");
    expect(result.institutionalPois[0].geographyType).toBe("INDIVIDUAL");
  });

  test("valid DENUE POI receives deterministic sourceEvidenceId and traceabilityId", () => {
    const result = canonicalizeDenuePoisForInstitutionalAnalysis([denueRaw()], {
      expedienteId: "exp-denue-1",
      canonicalGeography: pointGeography(),
      radiusMeters: 250,
    });

    const poi = result.institutionalPois[0];
    expect(poi.sourceEvidenceId).toBe("denue:010010001234");
    expect(poi.traceabilityId).toBe("trace:denue:exp-denue-1:geo-exp-denue-1-individual:denue:010010001234");
    expect(poi.epistemicIntegrity.traceabilityId).toBe(poi.traceabilityId);
  });

  test("invalid coordinate order or range is excluded from institutional analysis", () => {
    const result = canonicalizeDenuePoisForInstitutionalAnalysis(
      [denueRaw({ Latitud: "-102.29163", Longitud: "21.88182" })],
      {
        expedienteId: "exp-denue-1",
        canonicalGeography: pointGeography(),
        radiusMeters: 250,
      }
    );

    expect(result.institutionalPois).toHaveLength(0);
    expect(result.excludedPois[0].exclusionReason).toBe("INVALID_DENUE_COORDINATES");
  });

  test("0,0 coordinates are blocked", () => {
    const result = canonicalizeDenuePoisForInstitutionalAnalysis([denueRaw({ Latitud: 0, Longitud: 0 })], {
      expedienteId: "exp-denue-1",
      canonicalGeography: pointGeography(),
      radiusMeters: 250,
    });

    expect(result.institutionalPois).toHaveLength(0);
    expect(result.excludedPois[0].exclusionReason).toBe("INVALID_DENUE_COORDINATES");
  });

  test("DENUE POI outside the canonical territory is excluded", () => {
    const result = canonicalizeDenuePoisForInstitutionalAnalysis(
      [denueRaw({ Latitud: "21.90000", Longitud: "-102.31000" })],
      {
        expedienteId: "exp-denue-1",
        canonicalGeography: pointGeography(),
        radiusMeters: 250,
      }
    );

    expect(result.institutionalPois).toHaveLength(0);
    expect(result.excludedPois[0].exclusionReason).toBe("OUTSIDE_CANONICAL_POINT_RADIUS");
  });

  test("provider NO_DATA or FAILED statuses do not fabricate fallback POIs", () => {
    const noData = canonicalizeDenuePoisForInstitutionalAnalysis(
      { exito: true, total: 0, epistemicIntegrity: { acquisitionStatus: "NO_DATA" } },
      { expedienteId: "exp-denue-1", canonicalGeography: pointGeography(), radiusMeters: 250 }
    );
    const failed = canonicalizeDenuePoisForInstitutionalAnalysis(
      { exito: false, error: "Proveedor falló", epistemicIntegrity: { acquisitionStatus: "FAILED" } },
      { expedienteId: "exp-denue-1", canonicalGeography: pointGeography(), radiusMeters: 250 }
    );

    expect(noData.institutionalPois).toHaveLength(0);
    expect(noData.excludedPois).toHaveLength(0);
    expect(failed.institutionalPois).toHaveLength(0);
    expect(failed.excludedPois).toHaveLength(0);
  });

  test("provider acquisition exposes real DENUE POIs as observed source facts", () => {
    const prepared = prepareDenueAcquisitionPois([denueRaw()], {
      query: "21.8818,-102.2916,250",
      acquiredAt: "2026-09-05T00:00:00.000Z",
    });

    expect(prepared).toHaveLength(1);
    expect(prepared[0].sourceEvidenceId).toBe("denue:010010001234");
    expect(prepared[0].epistemicIntegrity.acquisitionMode).toBe("OBSERVED");
    expect(prepared[0].epistemicIntegrity.semanticRole).toBe("SOURCE_FACT");
    expect(prepared[0].coordinates).toEqual({ lat: 21.88182, lng: -102.29163 });
  });

  test("valid real DENUE reaches TIE with metadata preserved", () => {
    const canonical = canonicalizeDenuePoisForInstitutionalAnalysis([denueRaw()], {
      expedienteId: "exp-denue-1",
      canonicalGeography: pointGeography(),
      radiusMeters: 250,
    });

    const tem = TerritorialIntelligenceEngine.process(
      { id: "exp-denue-1", nombre: "Exp DENUE", lat: center.lat, lng: center.lng, radio: 250 },
      {},
      canonical.institutionalPois,
      {},
      [],
      []
    );

    expect(tem.economicAttractors).toHaveLength(1);
    expect(tem.economicAttractors[0].geographyId).toBe("geo-exp-denue-1-individual");
    expect(tem.economicAttractors[0].sourceEvidenceId).toBe("denue:010010001234");
    expect(tem.economicAttractors[0].traceabilityId).toBe(canonical.institutionalPois[0].traceabilityId);
    expect(tem.economicAttractors[0].epistemicIntegrity).toEqual(canonical.institutionalPois[0].epistemicIntegrity);
  });

  test("DENUE contributes territorial context but is never auto criminal evidence", () => {
    const result = canonicalizeDenuePoisForInstitutionalAnalysis([denueRaw()], {
      expedienteId: "exp-denue-1",
      canonicalGeography: pointGeography(),
      radiusMeters: 250,
    });

    expect(result.institutionalPois[0].publicationRole).toBe("TERRITORIAL_CONTEXT");
    expect(result.institutionalPois[0].evidenceDomain).toBe("TERRITORIAL_CONTEXT");
    expect(result.institutionalPois[0].semanticRole).toBe("SOURCE_FACT");
    expect(result.institutionalPois[0].isCriminalEvidence).toBe(false);
  });
});
