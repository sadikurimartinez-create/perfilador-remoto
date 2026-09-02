import {
  buildCrimeSourceCanonicalPayload,
  buildCrimeSourceFingerprint,
} from "@/utils/crimeIncidenceSourceFingerprint.server";

describe("ADR-022.8K - SOURCE_FINGERPRINT_V1", () => {
  test("same substantive payload with different OID produces same fingerprint", () => {
    const rowA = {
      FOLIO: "250164772",
      INCIDENTE: "ROBO A NEGOCIO",
      FECHA: "26/01/2025",
      HORA: "21",
      MINUTOS: "20",
      LONG: "-102.2745",
      LAT: "22.07123",
      OID: "1",
    };

    const rowB = {
      FOLIO: "250164772",
      INCIDENTE: "ROBO A NEGOCIO",
      FECHA: "26/01/2025",
      HORA: "21",
      MINUTOS: "20",
      LONG: "-102.2745",
      LAT: "22.07123",
      OID: "105",
    };

    expect(buildCrimeSourceFingerprint(rowA)).toBe(
      buildCrimeSourceFingerprint(rowB)
    );
  });

  test("different substantive payload produces different fingerprint", () => {
    const rowA = {
      FOLIO: "250164772",
      INCIDENTE: "ROBO A NEGOCIO",
      FECHA: "26/01/2025",
      HORA: "21",
      MINUTOS: "20",
      LONG: "-102.2745",
      LAT: "22.07123",
      OID: "1",
    };

    const rowB = {
      ...rowA,
      MINUTOS: "21",
      OID: "2",
    };

    expect(buildCrimeSourceFingerprint(rowA)).not.toBe(
      buildCrimeSourceFingerprint(rowB)
    );
  });

  test("field order does not affect canonical payload or fingerprint", () => {
    const rowA = {
      FOLIO: "250164772",
      INCIDENTE: "ROBO A NEGOCIO",
      FECHA: "26/01/2025",
      LAT: "22.07123",
      LONG: "-102.2745",
      OID: "1",
    };

    const rowB = {
      LONG: "-102.2745",
      OID: "105",
      LAT: "22.07123",
      FECHA: "26/01/2025",
      INCIDENTE: "ROBO A NEGOCIO",
      FOLIO: "250164772",
    };

    expect(buildCrimeSourceCanonicalPayload(rowA)).toBe(
      buildCrimeSourceCanonicalPayload(rowB)
    );

    expect(buildCrimeSourceFingerprint(rowA)).toBe(
      buildCrimeSourceFingerprint(rowB)
    );
  });

  test("fingerprint is lowercase SHA-256 hex with 64 characters", () => {
    const fingerprint = buildCrimeSourceFingerprint({
      FOLIO: "250164772",
      INCIDENTE: "ROBO A NEGOCIO",
      FECHA: "26/01/2025",
      LAT: "22.07123",
      LONG: "-102.2745",
      OID: "1",
    });

    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });
});