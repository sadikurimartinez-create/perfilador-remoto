import fs from "fs";
import path from "path";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("H6 - Cabinet Polygon expediente bridge", () => {
  const polygonSource = read("src/components/cabinet/CabinetPolygonWorkspace.tsx");
  const projectListSource = read("src/components/ProjectList.tsx");
  const consumerSource = read("src/components/CaptureAndAddPhoto.tsx");

  it("1. POLYGON exposes governed completion", () => {
    expect(polygonSource).toContain(
      'import type { CabinetCompletionResult } from "./cabinetCompletionContract";',
    );
    expect(polygonSource).toContain(
      "onComplete?: (result: CabinetCompletionResult) => void;",
    );
  });

  it("2. POLYGON emits confirmed canonical geography", () => {
    expect(polygonSource).toContain(
      'const draft = createDraftProjectGeography("poligono");',
    );
    expect(polygonSource).toContain(
      "const populatedDraft = updateDraftProjectGeography(draft, vertexPath);",
    );
    expect(polygonSource).toContain(
      "const confirmedDraft = confirmDraftProjectGeography(populatedDraft);",
    );
    expect(polygonSource).toContain('geometryType: "poligono"');
    expect(polygonSource).toContain("draftGeography: confirmedDraft");
  });

  it("3. every vertex evidence keeps VERTEX territorial reference", () => {
    expect(polygonSource).toContain(
      "streetViewEvidence: vertices.map((vertex, index) => ({",
    );
    expect(polygonSource).toContain("nodeId: vertex.id");
    expect(polygonSource).toContain("order: index + 1");
    expect(polygonSource).toContain('role: "VERTEX"');
    expect(polygonSource).toContain(
      "capture: captureByVertexId[vertex.id]",
    );
  });

  it("4. POLYGON completion is human and integrity gated", () => {
    expect(polygonSource).toContain("!geometryConfirmed");
    expect(polygonSource).toContain('workflowStep !== "REVIEW"');
    expect(polygonSource).toContain("!polygonIntegrityValid");
    expect(polygonSource).toContain("!allVerticesCaptured");
    expect(polygonSource).toContain("contextPois: [...contextPois]");
    expect(polygonSource).toContain(
      "Continuar con creación del expediente",
    );
  });

  it("5. ProjectList routes POLYGON through the rector bridge", () => {
    const start = projectListSource.indexOf("<CabinetPolygonWorkspace");
    expect(start).toBeGreaterThanOrEqual(0);

    const end = projectListSource.indexOf("/>", start);
    const block = projectListSource.slice(start, end + 2);

    expect(block).toContain(
      "onComplete={handleCabinetCompletion}",
    );
  });

  it("6. consumer accepts all three Cabinet geometries through same persistence", () => {
    expect(consumerSource).toContain(
      'pending.result.geometryType !== "individual" && pending.result.geometryType !== "lineal" && pending.result.geometryType !== "poligono"',
    );
    expect(consumerSource).toContain(
      "pending.result.streetViewEvidence.length",
    );
    expect(consumerSource).toContain(
      "territorialRef: evidence.territorialRef",
    );
    expect(consumerSource).toContain("await uploadAndAddPhoto(");
    expect(consumerSource).toContain(
      "for (const poi of pending.result.contextPois)",
    );
    expect(consumerSource).toContain(
      "await createGeographicEntity({",
    );
  });

  it("7. POLYGON workspace remains persistence-free", () => {
    expect(polygonSource).not.toContain("addDoc(");
    expect(polygonSource).not.toContain("setDoc(");
    expect(polygonSource).not.toContain("updateDoc(");
    expect(polygonSource).not.toContain("uploadBytes(");
    expect(polygonSource).not.toContain("uploadAndAddPhoto(");
    expect(polygonSource).not.toContain("createGeographicEntity(");
  });
});
