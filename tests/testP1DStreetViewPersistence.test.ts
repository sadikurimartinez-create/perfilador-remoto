jest.mock('server-only',()=>({}),{virtual:true});
jest.mock('firebase-admin/firestore',()=>({FieldValue:{serverTimestamp:()=> 'SERVER_TIME'}}));
import { adminFixture } from './helpers/p8InstitutionalAdminFixture';
import { GeointGovernanceStatus } from "../src/types/geointGovernance";
import {
  classifyHistoricalStreetViewFinding,
  StreetViewFindingService,
  type StreetViewFinding,
} from "../src/services/streetViewFindingService";
import { POST } from "../src/app/api/streetview/findings/route";
import { PATCH } from "../src/app/api/expedientes/[id]/evidencias/streetview/[captureId]/route";
import fs from "node:fs";
import path from "node:path";

const firestoreDocs = new Map<string, any>();
const setDocMock = jest.fn(async (ref: { path: string }, data: any, options?: { merge?: boolean }) => {
  firestoreDocs.set(ref.path, options?.merge ? { ...(firestoreDocs.get(ref.path) || {}), ...data } : data);
});
const mockCookiesGet = jest.fn();
const mockVerifySession = jest.fn();
jest.mock('@/services/institutionalProjectAccessService',()=>({authorizeInstitutionalProjectAccess:jest.fn(async(input:any)=>mockVerifySession(input.sessionToken)?{allowed:true,projectId:input.projectId,actor:{institutionalUserId:'user-real-1',username:'perfilador.real',role:'ADMIN'}}:{allowed:false})}));
jest.mock('@/lib/firebaseAdmin',()=>({getInstitutionalAdminDb:()=>{const store=adminFixture({'projects/exp-p1d':{deleted:false,estado:'ABIERTO'},...Object.fromEntries(firestoreDocs)});const run=store.db.runTransaction;store.db.runTransaction=async(work:any)=>{const result=await run(work);for(const [path,data]of store.entries())firestoreDocs.set(path,data);return result;};return store.db;}}));

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

jest.mock("next/headers", () => ({
  cookies: () => ({
    get: mockCookiesGet,
  }),
}));

jest.mock("../src/utils/authCrypto", () => ({
  verifySession: (token: string) => mockVerifySession(token),
}));

const subcollectionPath = (expedienteId: string, findingId: string) =>
  `projects/${expedienteId}/streetview_findings/${findingId}`;
const rootPath = (findingId: string) => `streetview_findings/${findingId}`;

const completeFinding = (overrides: Partial<StreetViewFinding> = {}): StreetViewFinding => ({
  id: "sv-p1d-1",
  expedienteId: "exp-p1d",
  traceabilityId: "trace-sv-p1d-1",
  sourceEvidenceId: "capture-p1d-1",
  geographyId: "geo-p1d",
  lineageStatus: "SUPPORTED",
  categoria: "RUTA_ACCESO",
  coordenadas: { lat: 21.885, lng: -102.291 },
  heading: 90,
  pitch: 0,
  imagen: "https://streetview.example/capture.jpg",
  estado: GeointGovernanceStatus.APPROVED_EVIDENCE,
  validationComment: "Convalidado en campo por analista.",
  ...overrides,
});

const requestWithBody = (body: any) =>
  ({
    url:"https://offline.test/api/streetview/findings", headers:new Headers({origin:"https://offline.test"}),
    json: async () => body,
  }) as any;

async function responseJson(response: Response) {
  return response.json();
}

describe("P1-D - Street View persistence", () => {
  beforeEach(() => {
    firestoreDocs.clear();
    setDocMock.mockClear();
    mockCookiesGet.mockReturnValue({ value: "session-token" });
    mockVerifySession.mockReturnValue({
      id: "user-real-1",
      username: "perfilador.real",
      role: "ADMIN",
      name: "Perfilador Real",
    });
  });

  test("T1 payload Street View valido persiste finding en subcoleccion y raiz", async () => {
    const response = await POST(requestWithBody(completeFinding()));
    const body = await responseJson(response);

    expect(response.status).toBe(201);
    expect(body.finding.id).toBe("sv-p1d-1");
    expect(firestoreDocs.get(subcollectionPath("exp-p1d", "sv-p1d-1"))).toMatchObject({
      id: "sv-p1d-1",
      expedienteId: "exp-p1d",
      usuarioRevision: "perfilador.real",
      createdBy: "perfilador.real",
      coordenadas: { lat: 21.885, lng: -102.291 },
      heading: 90,
      pitch: 0,
    });
    expect(firestoreDocs.get(rootPath("sv-p1d-1"))).toMatchObject({ id: "sv-p1d-1" });
  });

  test("T2 geo faltante devuelve 400 gobernado y no persiste", async () => {
    const response = await POST(requestWithBody(completeFinding({ coordenadas: { lat: null as any, lng: null as any } })));
    const body = await responseJson(response);

    expect(response.status).toBe(400);
    expect(body.error).toContain("STREETVIEW_FINDING_GEO_REQUIRED");
    expect(setDocMock).not.toHaveBeenCalled();
  });

  test("T3 trazabilidad incompleta devuelve 400 gobernado y no 500", async () => {
    const response = await POST(requestWithBody({
      ...completeFinding(),
      traceabilityId: "",
      sourceEvidenceId: "",
      captureId: "",
    }));
    const body = await responseJson(response);

    expect(response.status).toBe(400);
    expect(body.error).toContain("STREETVIEW_FINDING_TRACEABILITY_INCOMPLETE");
    expect(setDocMock).not.toHaveBeenCalled();
  });

  test("T4 identidad institucional invalida devuelve 403", async () => {
    mockVerifySession.mockReturnValue(null);

    const response = await POST(requestWithBody(completeFinding()));
    const body = await responseJson(response);

    expect(response.status).toBe(403);
    expect(body.error).toBe("GEOINT_ENTITY_ACCESS_DENIED");
    expect(setDocMock).not.toHaveBeenCalled();
  });

  test("T5 identidad sintetica enviada por cliente se rechaza", async () => {
    const response = await PATCH(
      requestWithBody({
        status: GeointGovernanceStatus.APPROVED_EVIDENCE,
        validatedBy: "UNAVAILABLE",
      }),
      { params: { id: "exp-p1d", captureId: "sv-p1d-1" } }
    );
    const body = await responseJson(response);

    expect(response.status).toBe(400);
    expect(body.error).toBe("STREETVIEW_HUMAN_IDENTITY_SYNTHETIC");
  });

  test("T6 identidad real de sesion permite aprobacion PATCH", async () => {
    firestoreDocs.set(subcollectionPath("exp-p1d", "sv-p1d-1"), completeFinding({ estado: GeointGovernanceStatus.PENDING_REVIEW }));

    const response = await PATCH(
      requestWithBody({
        status: GeointGovernanceStatus.APPROVED_EVIDENCE,
        validationComment: "Aprobado con identidad de sesion.",
      }),
      { params: { id: "exp-p1d", captureId: "sv-p1d-1" } }
    );

    expect(response.status).toBe(200);
    expect(firestoreDocs.get(subcollectionPath("exp-p1d", "sv-p1d-1"))).toMatchObject({
      estado: GeointGovernanceStatus.APPROVED_EVIDENCE,
      usuarioRevision: "perfilador.real",
      validationComment: "Aprobado con identidad de sesion.",
    });
  });

  test("T7 UI usa la actuación canónica única y no crea otro hallazgo", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/streetview/StreetViewFindingsPanel.tsx"), "utf8");
    expect(source).toContain("<EvidencePpcReviewCard");
    expect(source).not.toContain('fetch("/api/streetview/findings"');
    expect(source).not.toContain('method: "PATCH"');
    expect(source).not.toContain("onFindingCreated(");
  });

  test("T8 POST exitoso + PATCH exitoso mantiene finding/evidence consistentes", async () => {
    const postResponse = await POST(requestWithBody(completeFinding()));
    expect(postResponse.status).toBe(201);

    const patchResponse = await PATCH(
      requestWithBody({
        estado_revision: GeointGovernanceStatus.APPROVED_EVIDENCE,
        validationComment: "Secuencia completa.",
      }),
      { params: { id: "exp-p1d", captureId: "sv-p1d-1" } }
    );

    expect(patchResponse.status).toBe(200);
    expect(firestoreDocs.get(subcollectionPath("exp-p1d", "sv-p1d-1"))).toMatchObject({
      id: "sv-p1d-1",
      sourceEvidenceId: "capture-p1d-1",
      traceabilityId: "trace-sv-p1d-1",
      geographyId: "geo-p1d",
      estado: GeointGovernanceStatus.APPROVED_EVIDENCE,
      usuarioRevision: "perfilador.real",
    });
  });

  test("T9 callback recibe la confirmación final del circuito compartido", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/streetview/StreetViewFindingsPanel.tsx"), "utf8");
    expect(source).toContain("onConfirmed={record =>");
    expect(source).toContain("record.estado, record");
    expect(source).not.toContain("postPayload");
  });

  test("T10 UI compartida libera saving y conserva error server", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/EvidencePpcReviewPanel.tsx"), "utf8");
    expect(source).toContain("finally { setSaving(false); }");
    expect(source).toContain("catch { setError(true); }");
    expect(source).toContain("submission.current.isPending()");
  });

  test("T11 no se introducen coordenadas default para lat/lng", async () => {
    await expect(
      StreetViewFindingService.createStreetViewFinding({
        ...completeFinding(),
        coordenadas: { lat: 0, lng: 0 },
      })
    ).rejects.toThrow("STREETVIEW_FINDING_GEO_REQUIRED");

    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/streetview/StreetViewFindingsPanel.tsx"),
      "utf8"
    );
    expect(source).toContain("EvidencePpcReviewCard");
    expect(source).not.toContain("selectedCapture.geometry?.lat || 0");
    expect(source).not.toContain("selectedCapture.geometry?.lng || 0");
  });

  test("T12 idempotencia conserva entidad, mirror, outbox y auditoria sin duplicados", async () => {
    const payload=completeFinding({descripcion:"escritura deterministica"});
    const first=await POST(requestWithBody(payload));expect(first.status).toBe(201);
    const before=[...firestoreDocs.entries()];const second=await POST(requestWithBody(payload));expect(second.status).toBe(201);
    expect([...firestoreDocs.entries()]).toEqual(before);
    expect([...firestoreDocs.keys()].filter(path=>path.includes("streetview_findings/"))).toHaveLength(2);
    expect(firestoreDocs.get(subcollectionPath("exp-p1d","sv-p1d-1")).descripcion).toBe("escritura deterministica");
    expect(setDocMock).not.toHaveBeenCalled();
    expect([...firestoreDocs.keys()].filter(path=>path.startsWith("audit_logs/"))).toHaveLength(1);
  });

  test("T13 convalidación verifica la trazabilidad persistida en servidor", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/services/institutionalEvidenceReviewBoundary.ts"), "utf8");
    expect(source).toContain("normalizeStreetViewFindingForPersistence");
    expect(source).toContain("recoverHistoricalStreetViewFindingForApproval(candidate)");
  });

  test("T14 revisión identifica recurso existente y no envía evidencia inventada", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/EvidencePpcReviewPanel.tsx"), "utf8");
    expect(source).toContain("...current.reviewTarget");
    expect(source).toContain("expectedReview: reviewVersion(current)");
    expect(source).not.toContain("buildGeointTraceabilityId");
    expect(source).not.toContain("sourceEvidenceId:");
  });

  test("T15 P4-C historical recoverable se adapta conservadoramente durante PATCH", async () => {
    firestoreDocs.set(subcollectionPath("exp-p1d", "legacy-recoverable"), completeFinding({
      id: "legacy-recoverable",
      traceabilityId: "" as any,
      sourceEvidenceId: undefined,
      captureId: "capture-historical-real",
      geographyId: "geo-p1d",
      estado: GeointGovernanceStatus.PENDING_REVIEW,
      fechaCreacion: "2026-09-01T10:00:00.000Z",
      lineage: [],
      lineageStatus: "LEGACY_PARTIAL",
    }));

    const response = await PATCH(
      requestWithBody({
        status: GeointGovernanceStatus.APPROVED_EVIDENCE,
        validationComment: "Aprobacion historica recuperable.",
      }),
      { params: { id: "exp-p1d", captureId: "legacy-recoverable" } }
    );

    expect(response.status).toBe(200);
    expect(firestoreDocs.get(subcollectionPath("exp-p1d", "legacy-recoverable"))).toMatchObject({
      estado: GeointGovernanceStatus.APPROVED_EVIDENCE,
      sourceEvidenceId: "capture-historical-real",
      geographyId: "geo-p1d",
      lineageStatus: "SUPPORTED",
      usuarioRevision: "perfilador.real",
    });
    expect(firestoreDocs.get(subcollectionPath("exp-p1d", "legacy-recoverable")).traceabilityId).toContain("trace-streetview-historical");
  });

  test("T16 P4-C historical incomplete no se autoaprueba", async () => {
    firestoreDocs.set(subcollectionPath("exp-p1d", "legacy-incomplete"), completeFinding({
      id: "legacy-incomplete",
      traceabilityId: "" as any,
      sourceEvidenceId: undefined,
      captureId: "capture-incomplete-real",
      geographyId: null,
      estado: GeointGovernanceStatus.PENDING_REVIEW,
      fechaCreacion: "2026-09-01T10:00:00.000Z",
      lineageStatus: "LEGACY_PARTIAL",
    }));

    const response = await PATCH(
      requestWithBody({
        status: GeointGovernanceStatus.APPROVED_EVIDENCE,
        validationComment: "Intento historico incompleto.",
      }),
      { params: { id: "exp-p1d", captureId: "legacy-incomplete" } }
    );
    const body = await responseJson(response);

    expect(response.status).toBe(400);
    expect(body.error).toContain("STREET_VIEW_FINDING_PROMOTION_BLOCKED");
    expect(firestoreDocs.get(subcollectionPath("exp-p1d", "legacy-incomplete")).estado).toBe(GeointGovernanceStatus.PENDING_REVIEW);
  });

  test("T17 P4-C historical unrecoverable queda clasificado como bloqueado", () => {
    const result = classifyHistoricalStreetViewFinding({
      expedienteId: "exp-p1d",
      id: "legacy-unrecoverable",
      categoria: "RUTA_ACCESO",
      coordenadas: { lat: null as any, lng: null as any },
      estado: GeointGovernanceStatus.PENDING_REVIEW,
    });

    expect(result.classification).toBe("HISTORICAL_UNRECOVERABLE");
    expect(result.reasons).toEqual(expect.arrayContaining(["missing sourceEvidenceId", "missing geographyId", "invalid coordinates"]));
  });

  test("T18 P4-C no inventa coordenadas ni identidad humana en aprobacion UI/API", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/streetview/StreetViewFindingsPanel.tsx"),
      "utf8"
    );
    const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/streetview/findings/route.ts"), "utf8");
    const approveBlock = source.slice(source.indexOf("const handleApprove = async"), source.indexOf("const handleReject = async"));

    expect(source).toContain("EvidencePpcReviewCard");
    expect(approveBlock).not.toContain("|| 21.885");
    expect(approveBlock).not.toContain("|| -102.291");
    expect(route).toContain("executeInstitutionalGeointEntity");
    expect(route).not.toContain("resolveStreetViewSessionIdentity");
    const boundary=fs.readFileSync(path.join(process.cwd(),"src/services/institutionalGeointEntityBoundary.ts"),"utf8");
    expect(boundary).toContain("authorizeInstitutionalProjectAccess");
    expect(boundary).toContain("usuarioRevision:access.actor.username");
    expect(boundary).toContain("id:access.actor.institutionalUserId");
  });

  test("T19 P4-C report/export conserva traceabilityId real de Street View", () => {
    const reportInput = fs.readFileSync(
      path.join(process.cwd(), "src/utils/executiveGeointReportModel.ts"),
      "utf8"
    );

    expect(reportInput).toContain("input.streetView");
    expect(reportInput).toContain("traceabilityId");
  });
});
