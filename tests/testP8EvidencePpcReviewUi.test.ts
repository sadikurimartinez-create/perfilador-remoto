import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "fs";
import { resolve } from "path";
import ts from "typescript";
import { geographicEvidenceCoordinates, geographicEvidenceRole, photoResourceCollection } from "../src/utils/geographicEvidencePresentation";
import * as review from "../src/utils/institutionalEvidenceReview";
import * as human from "../src/utils/humanValidationPolicy";
import * as collector from "../src/utils/visualEvidenceEngine/streetViewCollector";

function harness(readOnly = false) {
  let cursor = 0; const slots: any[] = [];
  const hooks = { ...React,
    useState(initial: any) { const index = cursor++; if (!(index in slots)) slots[index] = initial;
      return [slots[index], (next: any) => { slots[index] = next; }]; },
    useRef(initial: any) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
  };
  const save = jest.fn(); const callback = jest.fn();
  const context = { project: { id: "A" }, album: [{ id: "photo", tipo: "PHOTO_FIELD", comentario: "Contexto", createdAt: 100,
    previewUrl: "https://fixture.test/image?token=SECRET_NOT_RENDERED_AS_TEXT" }], isReadOnly: readOnly,
    updateProjectDetails: jest.fn(), saveHumanHypothesis: jest.fn() };
  const file = resolve(__dirname, "../src/components/EvidencePpcReviewPanel.tsx");
  const output = ts.transpileModule(readFileSync(file, "utf8"), { fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
  const record = { exports: {} as any };
  new Function("require", "module", "exports", output)((name: string) => {
    if (name === "react") return hooks;
    if (name === "@/context/ProjectContext") return { useProject: () => context };
    if (name === "@/lib/institutionalGeointEntityActions") return { reviewInstitutionalEvidence: save };
    if (name === "@/utils/institutionalEvidenceReview") return review;
    if (name === "@/utils/humanValidationPolicy") return human;
    if (name === "@/utils/visualEvidenceEngine/streetViewCollector") return collector;
    throw new Error(`Unexpected import ${name}`);
  }, record, record.exports);
  const item = { ...context.album[0], reviewTarget: { source: "PHOTO", id: "photo" } };
  function render() { cursor = 0; return record.exports.EvidencePpcReviewCard({ projectId: "A", item, readOnly, onConfirmed: callback, save }); }
  function elements(tree: any, type: string): any[] {
    if (!tree || typeof tree !== "object") return [];
    return [...(tree.type === type ? [tree] : []), ...React.Children.toArray(tree.props?.children).flatMap(child => elements(child, type))];
  }
  return { render, elements, save, callback, context, item, photoPanel: record.exports.PhotoPpcReviewPanel };
}
test("legacy photo shows unreviewed, explicit decisions and no URL/secret text", () => {
  const h = harness(); const html = renderToStaticMarkup(h.render());
  expect(html).toContain("Sin revisar"); expect(html).toContain("Devolver para reanálisis");
  expect(html).toContain("DISPONIBILIDAD_NO_COMPROBADA");
  expect(html).not.toContain("SECRET_NOT_RENDERED_AS_TEXT");
  expect(h.photoPanel()).not.toBeNull();
});
test("actual card prevents concurrent decision, disables input, and shows only final server state", async () => {
  const h = harness(); let finish!: (value: any) => void;
  h.save.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  h.elements(h.render(), "textarea")[0].props.onChange({ target: { value: "Revisión PPC" } });
  const approve = h.elements(h.render(), "button").find(button => button.props.children === "Aprobar");
  const pending = approve.props.onClick(); await approve.props.onClick();
  expect(h.save).toHaveBeenCalledTimes(1); expect(h.callback).not.toHaveBeenCalled();
  expect(h.elements(h.render(), "textarea")[0].props.disabled).toBe(true);
  expect(h.elements(h.render(), "button").filter(button => button.props.children === "Guardando…").every(button => button.props.disabled)).toBe(true);
  const final = { ...h.item, humanValidationStatus: "APPROVED", validatedBy: { id: "1", name: "PPC" }, validatedAt: "2026-10-03T00:00:00Z", validationComment: "Revisión PPC" };
  finish(final); await pending;
  expect(h.callback).toHaveBeenCalledWith(final); expect(renderToStaticMarkup(h.render())).toContain("Aprobada");
  expect(h.context.updateProjectDetails).not.toHaveBeenCalled(); expect(h.context.saveHumanHypothesis).not.toHaveBeenCalled();
});
test("server rejection remains unreviewed, shows alert and cannot report successful callback", async () => {
  const h = harness(); h.save.mockRejectedValue(new Error("SERVER_403"));
  h.elements(h.render(), "textarea")[0].props.onChange({ target: { value: "Motivo" } });
  await h.elements(h.render(), "button").find(button => button.props.children === "Rechazar").props.onClick();
  const html = renderToStaticMarkup(h.render()); expect(html).toContain("No se confirmó la revisión"); expect(html).toContain("Sin revisar");
  expect(h.callback).not.toHaveBeenCalled(); expect(h.save).toHaveBeenCalledTimes(1);
});
test("image checks are opt-in and non-destructive with distinct available/broken states", () => {
  const h = harness(); expect(h.elements(h.render(), "img")).toHaveLength(0);
  h.elements(h.render(), "button").find(button => button.props.children === "Ver imagen").props.onClick();
  h.elements(h.render(), "img")[0].props.onLoad(); expect(renderToStaticMarkup(h.render())).toContain("IMAGEN_DISPONIBLE");
  h.elements(h.render(), "img")[0].props.onError(); expect(renderToStaticMarkup(h.render())).toContain("REFERENCIA_ROTA");
  expect(h.save).not.toHaveBeenCalled();
});
test("read-only disables all decisions and guards programmatic clicks", async () => {
  const h = harness(true); h.elements(h.render(), "textarea")[0].props.onChange({ target: { value: "Motivo" } });
  const button = h.elements(h.render(), "button").find(item => item.props.children === "Aprobar");
  expect(button.props.disabled).toBe(true); await button.props.onClick(); expect(h.save).not.toHaveBeenCalled();
});

test("the mounted Street View console hydrates persisted captures, deduplicates and emits final canonical record", async () => {
  let cursor = 0; const slots: any[] = []; let effectRun = false;
  const hooks = { ...React,
    useState(initial: any) { const index = cursor++; if (!(index in slots)) slots[index] = initial;
      return [slots[index], (next: any) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }]; },
    useEffect(effect: () => void) { if (!effectRun) { effectRun = true; effect(); } },
  };
  const stored = { id: "sv", tipo: "STREET_VIEW", sourceEvidenceId: "ev", humanValidationStatus: "UNREVIEWED" };
  const list = jest.fn().mockResolvedValue([stored]);
  const Card = () => null; const changed = jest.fn(); const findingCreated = jest.fn();
  const filename = resolve(__dirname, "../src/components/streetview/StreetViewFindingsPanel.tsx");
  const output = ts.transpileModule(readFileSync(filename, "utf8"), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const module = { exports: {} as any };
  new Function("require", "module", "exports", output)((name: string) => {
    if (name === "react") return hooks;
    if (name === "@/context/ProjectContext") return { useProject: () => ({ isReadOnly: false }) };
    if (name === "../EvidencePpcReviewPanel") return { EvidencePpcReviewCard: Card };
    if (name === "@/lib/institutionalGeointEntityActions") return { persistInstitutionalGeointEntity: list };
    if (name === "@/utils/institutionalEvidenceReview") return review;
    if (name === "@/utils/humanValidationPolicy") return human;
    throw new Error(`Unexpected runtime import ${name}`);
  }, module, module.exports);
  const captures = review.reconcileStreetViewReviewItems([], [{ ...stored, captureId: "sv" }], []);
  function render() { cursor = 0; return module.exports.StreetViewFindingsPanel({ expedienteId: "A", captures, onCaptureStatusChange: changed, onFindingCreated: findingCreated }); }
  function find(tree: any, type: any): any[] { if (!tree || typeof tree !== "object") return [];
    return [...(tree.type === type ? [tree] : []), ...React.Children.toArray(tree.props?.children).flatMap(child => find(child, type))]; }
  render(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  const buttons = find(render(), "button"); expect(buttons).toHaveLength(1);
  buttons[0].props.onClick(); const card = find(render(), Card)[0];
  expect(card.props.readOnly).toBe(false); expect(card.props.item.reviewTarget.source).toBe("STREETVIEW_FINDING");
  const final = { ...stored, estado: "REJECTED_FINDING", humanValidationStatus: "REJECTED",
    validatedAt: "2026-10-03T10:00:00Z", validationSource: "ADR_020_24_HUMAN_ACTION", reviewTarget: card.props.item.reviewTarget };
  card.props.onConfirmed(final);
  expect(changed).toHaveBeenCalledWith("sv", "REJECTED_FINDING", final);
  expect(findingCreated).not.toHaveBeenCalled(); expect(find(render(), Card)[0].props.item.humanValidationStatus).toBe("REJECTED");
  expect(list).toHaveBeenCalledWith({ projectId: "A", kind: "STREETVIEW", operation: "LIST" });
});

test.each([false, true])("real contextualization callback routes document=%s without changing human review", async documentPhoto => {
  const source = readFileSync(resolve(__dirname, "../src/context/ProjectContext.tsx"), "utf8");
  const start = source.indexOf("  const savePhotoContextualization = useCallback");
  const end = source.indexOf("}, [project, album, isReadOnly, user, logAuditAction]);", start) + "}, [project, album, isReadOnly, user, logAuditAction]);".length;
  const output = ts.transpileModule(source.slice(start, end) + "\nreturn savePhotoContextualization;", { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const update = jest.fn().mockResolvedValue(undefined); const audit = jest.fn().mockResolvedValue(undefined);
  const approved = { id: "photo", ...(documentPhoto ? { sourceDocumentId: "original-document", geometryRole: "NONE" } : {}), tipo: "FIELD", comentario: "Contexto", lat: 21, lng: -102, humanValidationStatus: "APPROVED" };
  const execute = new Function("useCallback", "isReadOnly", "project", "album", "user", "getDb", "doc", "updateDoc", "setAlbum", "logAuditAction", "photoResourceCollection", "geographicEvidenceRole", "geographicEvidenceCoordinates", "setDocuments", output);
  const locator = jest.fn((...parts: any[]) => parts.slice(1).join("/"));
  const documents = jest.fn();
  const callback = execute((fn: any) => fn, false, { id: "A" }, [approved], { username: "PPC" }, () => ({}), locator, update, () => {}, audit, photoResourceCollection, geographicEvidenceRole, geographicEvidenceCoordinates, documents);
  await callback("photo");
  expect(update).toHaveBeenCalledTimes(1);
  expect(update.mock.calls[0][0]).toBe(documentPhoto ? "projects/A/documents/original-document" : "projects/A/photos/photo");
  if (documentPhoto) expect(documents).toHaveBeenCalled();
  expect(update.mock.calls[0][1]).not.toHaveProperty("humanValidationStatus");
  expect(update.mock.calls[0][1]).not.toHaveProperty("validationSource");
  expect(approved.humanValidationStatus).toBe("APPROVED");
  expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "GUARDAR_CONTEXTUALIZACION" }));
});
