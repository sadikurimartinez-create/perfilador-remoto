import fs from "node:fs";
import path from "node:path";

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("ADR-020.38 feature/main functional reconciliation", () => {
  const mapSource = source("src/components/maps/ProfessionalGeoMap.tsx");
  const albumSource = source("src/components/PhotoAlbum.tsx");
  const gangsSource = source("src/modules/pandillas/pandillas.ui.tsx");

  test("TEST A-D ProfessionalGeoMap preserves governance, has no key fallback, and observes resize", () => {
    expect(mapSource).toContain("useOptionalAnalyticsFilter");
    expect(mapSource).toContain("CrimeIncidenceLayer");
    expect(mapSource).toContain("crimeIncidenceMinimumHeight");
    expect(mapSource).toContain('"drawing"');
    expect(mapSource).toContain("process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? \"\"");
    expect(mapSource).toContain("new ResizeObserver");
    expect(mapSource).toContain('google.maps.event.trigger(mapInstance, "resize")');
    expect(mapSource).toContain("resizeObserver.disconnect()");
  });

  test("TEST E ProfessionalGeoMap does not introduce hidden ProjectContext deletion", () => {
    expect(mapSource).not.toContain("useProject(");
    expect(mapSource).not.toContain("EvidenceDeleteConfirmModal");
  });

  test("TEST F-I PhotoAlbum preserves institutional and evidence governance", () => {
    expect(albumSource).toContain("process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? \"\"");
    expect(albumSource).toContain("canProceedWithInstitutionalAnalysis");
    expect(albumSource).toContain("effectiveCanonicalHypothesis");
    expect(albumSource).toContain("canonicalHypothesis: effectiveCanonicalHypothesis");
    expect(albumSource).toContain("createGeographicEntity");
    expect(albumSource).toContain("saveHumanHypothesis");
    expect(albumSource).not.toContain("data:image/png;base64");
  });

  test("TEST J StreetViewCaptureService reconciliation is deliberately deferred", () => {
    expect(albumSource).not.toContain('from "@/services/streetViewCaptureService"');
  });

  test("TEST K contextual registers cannot create visual evidence", () => {
    for (const engine of [
      "Incidencia Delictiva",
      "Consulta Vehicular (REPUVE)",
      "Registro de Desaparecidos (RNPDNO)",
      "Búsqueda Multimodal Geo-Espacial",
      "Giros Comerciales (DENUE)",
    ]) {
      const start = albumSource.indexOf(`engine: "${engine}"`);
      expect(start).toBeGreaterThan(-1);
      expect(albumSource.slice(start, start + 400)).toContain("createVisualEvidence: false");
    }
  });

  test("TEST L-M Pandillas preserves ADR-020.37 and marks its AI summary non-visual", () => {
    expect(gangsSource).toContain("adaptPandillasCanonicalInput");
    expect(gangsSource).toContain("canonicalProjectCenter");
    expect(gangsSource).toContain("projectLat != null");
    expect(gangsSource).toContain("projectLng != null");
    expect(gangsSource).toContain("dist <= 1000");
    const start = gangsSource.indexOf('engine: "Mesa de Inteligencia de Pandillas (AI)"');
    expect(start).toBeGreaterThan(-1);
    expect(gangsSource.slice(start, start + 400)).toContain("createVisualEvidence: false");
  });
});
