import fs from "fs";
import path from "path";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("H5 - Cabinet Lineal expediente bridge", () => {
  const linearSource = read("src/components/cabinet/CabinetLinearWorkspace.tsx");
  const projectListSource = read("src/components/ProjectList.tsx");
  const consumerSource = read("src/components/CaptureAndAddPhoto.tsx");

  it("1. LINEAL exposes governed completion", () => {
    expect(linearSource).toContain(
      'import type { CabinetCompletionResult } from "./cabinetCompletionContract";',
    );
    expect(linearSource).toContain(
      "onComplete?: (result: CabinetCompletionResult) => void;",
    );
  });

  it("2. LINEAL emits confirmed canonical geography", () => {
    expect(linearSource).toContain(
      'const draft = createDraftProjectGeography("lineal");',
    );
    expect(linearSource).toContain(
      "const populatedDraft = updateDraftProjectGeography(draft, vertexPath);",
    );
    expect(linearSource).toContain(
      "const confirmedDraft = confirmDraftProjectGeography(populatedDraft);",
    );
    expect(linearSource).toContain('geometryType: "lineal"');
    expect(linearSource).toContain("draftGeography: confirmedDraft");
  });

  it("3. NI PI NF evidence retains territorial references", () => {
    expect(linearSource).toContain(
      "streetViewEvidence: vertices.map((vertex, index) => ({",
    );
    expect(linearSource).toContain("nodeId: vertex.id");
    expect(linearSource).toContain("order: index + 1");
    expect(linearSource).toContain(
      "role: corridorVertexRole(index, vertices.length)",
    );
    expect(linearSource).toContain(
      "capture: captureByVertexId[vertex.id]",
    );
  });

  it("4. LINEAL completion is human and integrity gated", () => {
    expect(linearSource).toContain("!geometryConfirmed");
    expect(linearSource).toContain('workflowStep !== "REVIEW"');
    expect(linearSource).toContain("!corridorIntegrity.isValid");
    expect(linearSource).toContain("!allVerticesCaptured");
    expect(linearSource).toContain("contextPois: [...contextPois]");
    expect(linearSource).toContain(
      "Continuar con creación del expediente",
    );
  });

  it("5. ProjectList routes LINEAL through rector bridge", () => {
    const start = projectListSource.indexOf("<CabinetLinearWorkspace");
    expect(start).toBeGreaterThanOrEqual(0);

    const end = projectListSource.indexOf("/>", start);
    const block = projectListSource.slice(start, end + 2);

    expect(block).toContain(
      "onComplete={handleCabinetCompletion}",
    );
  });

  it("6. consumer accepts Individual and LINEAL through same persistence", () => {
    expect(consumerSource).toContain(
      'pending.result.geometryType !== "individual" && pending.result.geometryType !== "lineal"',
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

  it("7. LINEAL workspace remains persistence-free", () => {
    expect(linearSource).not.toContain("addDoc(");
    expect(linearSource).not.toContain("setDoc(");
    expect(linearSource).not.toContain("updateDoc(");
    expect(linearSource).not.toContain("uploadBytes(");
    expect(linearSource).not.toContain("uploadAndAddPhoto(");
    expect(linearSource).not.toContain("createGeographicEntity(");
  });
});
