import fs from "node:fs";
import path from "node:path";

function source(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("QA-06.03E.3B Hacienda San Marcos recovery caller", () => {
  const page = source("src/app/admin/historical-recovery/hacienda-san-marcos/page.tsx");
  const projectContext = source("src/context/ProjectContext.tsx");
  const finderBlock = projectContext.slice(
    projectContext.indexOf("const findHistoricalRecoveryProjectsBySource"),
    projectContext.indexOf("const assignHistoricalNumeroExpediente")
  );

  test("uses the controlled historical source identity and lineal receiver", () => {
    expect(page).toContain("const SOURCE_PROJECT_ID = \"XLeeM0Xz5bemDlwgn8eP\"");
    expect(page).toContain("const SOURCE_PROJECT_NAME = \"Hacienda San Marcos Lineal\"");
    expect(page).toContain("const SOURCE_GEOMETRY_TYPE = \"LINEAL\"");
    expect(page).toContain("geometryType: \"lineal\"");
    expect(page).toContain("sourceProjectId: SOURCE_PROJECT_ID");
    expect(page).toContain("sourceProjectName: SOURCE_PROJECT_NAME");
    expect(page).toContain("sourceGeometryType: SOURCE_GEOMETRY_TYPE");
  });

  test("defines exactly seven GPS candidate coordinate entries", () => {
    const coordinates = [
      "lat: 21.8053055556, lng: -102.2704138889",
      "lat: 21.8055277778, lng: -102.2707416667",
      "lat: 21.8055277778, lng: -102.2707416667",
      "lat: 21.8051805556, lng: -102.27055",
      "lat: 21.8051805556, lng: -102.27055",
      "lat: 21.8054694444, lng: -102.2701916667",
      "lat: 21.8070805556, lng: -102.270475",
    ];
    for (const coordinate of coordinates) {
      expect(page).toContain(coordinate);
    }
    expect((page.match(/lat:/g) || []).length).toBe(8);
    expect((page.match(/lng:/g) || []).length).toBe(8);
  });

  test("keeps duplicated GPS points as separate candidates", () => {
    expect((page.match(/21\.8055277778, lng: -102\.2707416667/g) || []).length).toBe(2);
    expect((page.match(/21\.8051805556, lng: -102\.27055/g) || []).length).toBe(2);
    expect(page).toContain("candidateId: `hacienda-gps-${String(index + 1).padStart(2, \"0\")}`");
  });

  test("builds discovered in-situ photo GPS candidates with high confidence", () => {
    expect(page).toContain("sourceType: \"IN_SITU_PHOTO_GPS\"");
    expect(page).toContain("status: \"DISCOVERED\"");
    expect(page).toContain("confidence: \"HIGH\"");
    expect(page).toContain("\"HISTORICAL_PROJECT_PURGED\"");
    expect(page).toContain("`SOURCE_PROJECT_ID:${SOURCE_PROJECT_ID}`");
    expect(page).toContain("\"HUMAN_ORDER_REQUIRED\"");
    expect(page).toContain("\"PHOTO_GPS_IS_CANDIDATE_NOT_VERTEX\"");
    expect(page).not.toContain("status: \"SELECTED\"");
  });

  test("candidate projectId is the new receiver, not the historical source id", () => {
    expect(page).toContain("buildHaciendaSanMarcosHistoricalCandidates(\n  projectId: string");
    expect(page).toContain("projectId,");
    expect(page).toContain("activeRecoveryProjectId ? buildHaciendaSanMarcosHistoricalCandidates(activeRecoveryProjectId) : []");
    expect(page).not.toContain("projectId: SOURCE_PROJECT_ID");
    expect(page).not.toContain("projectId: \"XLeeM0Xz5bemDlwgn8eP\"");
  });

  test("does not invent unavailable forensic lineage fields", () => {
    expect(page).toContain("sourceObjectPath: null");
    expect(page).toContain("sourcePhotoId: null");
    expect(page).toContain("sourceEvidenceId: null");
    expect(page).toContain("capturedAt: null");
    expect(page).not.toContain("projects/${SOURCE_PROJECT_ID}/photos");
    expect(page).not.toContain("photo-");
    expect(page).not.toContain("evidence-");
  });

  test("does not build geometry, vertices or deduplicated candidates", () => {
    expect(page).not.toContain("canonicalGeography");
    expect(page).not.toContain("LineString");
    expect(page).not.toContain("Point");
    expect(page).not.toContain("Polygon");
    expect(page).not.toContain("type: \"VERTEX\"");
    expect(page).not.toContain("sourceType: \"VERTEX\"");
    expect(page).not.toContain("isVertex");
    expect(page).not.toContain("geographicEntities");
    expect(page).not.toContain("centroid");
    expect(page).not.toContain("nearest");
    expect(page).not.toContain(".sort(");
    expect(page).not.toContain("deduplicateHistoricalGeographyCandidates");
  });

  test("renders the required controlled UI text and explicit creation button", () => {
    expect(page).toContain("RECUPERACIÓN HISTÓRICA CONTROLADA");
    expect(page).toContain("Hacienda San Marcos");
    expect(page).toContain("expediente histórico fue purgado");
    expect(page).toContain("GPS se presentan como candidatos");
    expect(page).toContain("no como vértices");
    expect(page).toContain("orden requiere decisión humana");
    expect(page).toContain("Crear expediente de recuperacion");
    expect(page).toContain("PENDIENTE DE RECONCILIACION HUMANA");
    expect(page).toContain("RECUPERACIÓN EXISTENTE REANUDADA");
    expect(page).toContain("MULTIPLE_RECOVERIES_DETECTED");
  });

  test("protects creation against double click and creation failure", () => {
    expect(page).toContain("const [creationArmed, setCreationArmed] = React.useState(false)");
    expect(page).toContain("const createInFlightRef = React.useRef(false)");
    expect(page).toContain("if (!creationArmed || hasExistingRecovery || isCreating || createInFlightRef.current || createdProjectId) return");
    expect(page).toContain("createInFlightRef.current = true");
    expect(page).toContain("createInFlightRef.current = false");
    expect(page).toContain("disabled={isLookingUpRecovery || hasExistingRecovery || !creationArmed || isCreating || Boolean(createdProjectId)}");
    expect(page).toContain("setError(err instanceof Error ? err.message");
    expect(page.indexOf("const newProjectId = await createHistoricalRecoveryProject")).toBeLessThan(
      page.indexOf("setCreatedProjectId(newProjectId)")
    );
  });

  test("uses createHistoricalRecoveryProject as the only creation mechanism", () => {
    expect(page).toContain("createHistoricalRecoveryProject");
    expect(page).toContain("findHistoricalRecoveryProjectsBySource");
    expect(page).toContain("loadProject");
    expect(page).toContain("await createHistoricalRecoveryProject({");
    expect(page).toContain("onClick={handleCreateRecoveryProject}");
    expect(page).toContain("Confirmo crear un expediente institucional nuevo de recuperación histórica");
    expect(page.indexOf("React.useEffect")).toBeLessThan(page.indexOf("const handleCreateRecoveryProject"));
    expect(page).not.toContain("createProject(");
    expect(page).not.toContain("addDoc(");
    expect(page).not.toContain("setDoc(");
    expect(page).not.toContain("updateDoc(");
  });

  test("hands candidates to GeographicWorkspace and does not persist reconciliation from caller", () => {
    expect(page).toContain("<GeographicWorkspace historicalGeographyCandidatesInput={candidates} />");
    expect(page).not.toContain("persistHistoricalGeographyReconciliation");
    expect(page).not.toContain("confirmHistoricalGeographyReconciliation");
    expect(page).not.toContain("selectHistoricalGeographyCandidates");
    expect(page).not.toContain("discardHistoricalGeographyCandidates");
  });

  test("resumes persisted recovery by historical lineage instead of ephemeral createdProjectId", () => {
    expect(page).toContain("findHistoricalRecoveryProjectsBySource(SOURCE_PROJECT_ID)");
    expect(page).toContain("setResumedProjectId(recovery.id)");
    expect(page).toContain("setResumeNumeroExpediente(recovery.numeroExpediente || null)");
    expect(page).toContain("await loadProject(recovery.id)");
    expect(page).toContain("const activeRecoveryProjectId = resumedProjectId || createdProjectId");
    expect(page).toContain("<GeographicWorkspace historicalGeographyCandidatesInput={candidates} />");
    expect(page).not.toContain("cs3Uig15ZRAqEiFoJR4y");
  });

  test("existing or multiple recoveries block automatic creation of another recovery", () => {
    expect(page).toContain("const hasExistingRecovery = Boolean(resumedProjectId)");
    expect(page).toContain("setRecoveryCount(recoveries.length)");
    expect(page).toContain("recoveryCount > 1");
    expect(page).toContain("se usa la más antigua por recoveredAt/createdAt/secuencia");
    expect(page).toContain("disabled={isLookingUpRecovery || hasExistingRecovery || isCreating || Boolean(createdProjectId)}");
    expect(page).toContain("disabled={isLookingUpRecovery || hasExistingRecovery || !creationArmed || isCreating || Boolean(createdProjectId)}");
  });

  test("ProjectContext finds recoveries with read-only Firestore query by sourceProjectId", () => {
    expect(projectContext).toContain("findHistoricalRecoveryProjectsBySource: (sourceProjectId: string) => Promise<Project[]>");
    expect(projectContext).toContain("findHistoricalRecoveryProjectsBySource,");
    expect(finderBlock).toContain("where(\"historicalProjectRecoveryOrigin.sourceProjectId\", \"==\", sourceId)");
    expect(finderBlock).toContain("const snap = await getDocs(recoveryQuery)");
    expect(finderBlock).toContain("deserializeCanonicalGeographyFromFirestore");
    expect(finderBlock).toContain("recoveredAt ?? a.createdAt");
    expect(finderBlock).toContain("numeroExpedienteSequence");
    expect(finderBlock).not.toContain("setDoc");
    expect(finderBlock).not.toContain("addDoc");
    expect(finderBlock).not.toContain("updateDoc");
    expect(finderBlock).not.toContain("runTransaction");
  });
});
