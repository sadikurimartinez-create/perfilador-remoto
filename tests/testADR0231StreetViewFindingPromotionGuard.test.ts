import {
  StreetViewFindingService,
  type StreetViewFinding,
} from "../src/services/streetViewFindingService";
import { GeointGovernanceStatus } from "../src/types/geointGovernance";

const firestoreDocs = new Map<string, any>();
const setDocMock = jest.fn(async (ref: { path: string }, data: any, options?: { merge?: boolean }) => {
  firestoreDocs.set(ref.path, options?.merge ? { ...(firestoreDocs.get(ref.path) || {}), ...data } : data);
});

jest.mock("firebase/firestore", () => ({
  collection: jest.fn((...parts: string[]) => ({ path: parts.slice(1).join("/") })),
  doc: jest.fn((_: unknown, ...parts: string[]) => ({ path: parts.join("/") })),
  getDoc: jest.fn(async (ref: { path: string }) => ({
    exists: () => firestoreDocs.has(ref.path),
    data: () => firestoreDocs.get(ref.path),
  })),
  setDoc: (...args: any[]) => setDocMock(...args),
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
}));

jest.mock("../src/lib/firebaseServer", () => ({
  getFirebaseServerDb: jest.fn(() => ({})),
}));

jest.mock("../src/lib/firebase", () => ({
  getDb: jest.fn(() => ({})),
}));

const subcollectionPath = (expedienteId: string, findingId: string) =>
  `projects/${expedienteId}/streetview_findings/${findingId}`;

const completeFinding = (overrides: Partial<StreetViewFinding> = {}): StreetViewFinding => ({
  id: "sv-finding-1",
  expedienteId: "exp-1",
  traceabilityId: "trace-1",
  sourceEvidenceId: "source-1",
  geographyId: "geo-1",
  lineageStatus: "COMPLETE",
  categoria: "RUTA_ACCESO",
  coordenadas: { lat: 21.885, lng: -102.291 },
  estado: GeointGovernanceStatus.PENDING_REVIEW,
  ...overrides,
});

describe("ADR-023.1 - Street View finding promotion guard", () => {
  beforeEach(() => {
    firestoreDocs.clear();
    setDocMock.mockClear();
  });

  test("permite APPROVED_EVIDENCE cuando el finding tiene trazabilidad completa", async () => {
    firestoreDocs.set(subcollectionPath("exp-1", "sv-finding-1"), completeFinding());

    await expect(
      StreetViewFindingService.updateStreetViewFindingStatus("exp-1", "sv-finding-1", {
        estado: GeointGovernanceStatus.APPROVED_EVIDENCE,
      })
    ).resolves.toBe(true);

    expect(firestoreDocs.get(subcollectionPath("exp-1", "sv-finding-1")).estado).toBe(
      GeointGovernanceStatus.APPROVED_EVIDENCE
    );
  });

  test("bloquea APPROVED_EVIDENCE para finding legacy sin geographyId", async () => {
    firestoreDocs.set(subcollectionPath("exp-1", "sv-finding-1"), completeFinding({ geographyId: null }));

    await expect(
      StreetViewFindingService.updateStreetViewFindingStatus("exp-1", "sv-finding-1", {
        estado: GeointGovernanceStatus.APPROVED_EVIDENCE,
      })
    ).rejects.toThrow("STREET_VIEW_FINDING_PROMOTION_BLOCKED");
  });

  test("bloquea APPROVED_EVIDENCE para finding sin sourceEvidenceId", async () => {
    firestoreDocs.set(
      subcollectionPath("exp-1", "sv-finding-1"),
      completeFinding({ sourceEvidenceId: undefined, evidenciaId: undefined, captureId: undefined })
    );

    await expect(
      StreetViewFindingService.updateStreetViewFindingStatus("exp-1", "sv-finding-1", {
        estado: GeointGovernanceStatus.APPROVED_EVIDENCE,
      })
    ).rejects.toThrow("STREET_VIEW_FINDING_PROMOTION_BLOCKED");
  });

  test("bloquea APPROVED_EVIDENCE para finding sin lineage valido", async () => {
    firestoreDocs.set(subcollectionPath("exp-1", "sv-finding-1"), completeFinding({ lineageStatus: "LEGACY_PARTIAL" }));

    await expect(
      StreetViewFindingService.updateStreetViewFindingStatus("exp-1", "sv-finding-1", {
        estado: GeointGovernanceStatus.APPROVED_EVIDENCE,
      })
    ).rejects.toThrow("STREET_VIEW_FINDING_PROMOTION_BLOCKED");
  });

  test("permite mantener PENDING_REVIEW en findings legacy incompletos", async () => {
    firestoreDocs.set(
      subcollectionPath("exp-1", "legacy-finding"),
      completeFinding({
        id: "legacy-finding",
        geographyId: null,
        sourceEvidenceId: undefined,
        lineageStatus: "LEGACY_PARTIAL",
      })
    );

    await expect(
      StreetViewFindingService.updateStreetViewFindingStatus("exp-1", "legacy-finding", {
        estado: GeointGovernanceStatus.PENDING_REVIEW,
      })
    ).resolves.toBe(true);

    expect(firestoreDocs.get(subcollectionPath("exp-1", "legacy-finding")).estado).toBe(
      GeointGovernanceStatus.PENDING_REVIEW
    );
  });
});
