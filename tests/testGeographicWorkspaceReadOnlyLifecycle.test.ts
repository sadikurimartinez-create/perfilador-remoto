import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { compactFindingRef } from "../src/utils/projectRootReconciliation";

const approved = { id: "new", estado: "APPROVED_EVIDENCE", sourceEvidenceId: "evidence" };

// Execute the real component and its effects with a small hook host; children are isolated.
function host(refs: any[] = []) {
  const updateProjectDetails = jest.fn(async () => undefined);
  const writes = jest.fn();
  const project = { id: "project", approvedFindingRefs: refs };
  let cursor = 0;
  const slots: any[] = [];
  const pending: Array<() => void> = [];
  const elements: any[] = [];
  const react = {
    createElement: (type: any, props: any, ...children: any[]) => {
      const element = { type, props: { ...props, children } }; elements.push(element); return element;
    },
    useState: (initial: any) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (next: any) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
    },
    useMemo: (fn: any) => fn(),
    useCallback: (fn: any) => fn,
    useEffect: (fn: any, deps: any[]) => {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) {
        previous?.cleanup?.();
        slots[index] = { deps };
        pending.push(() => { slots[index].cleanup = fn(); });
      }
    },
  };
  const source = fs.readFileSync(path.join(process.cwd(), "src/components/GeographicWorkspace.tsx"), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }).outputText;
  const componentNames = ["ProfessionalGeoMap", "StreetViewFindingsPanel", "StreetViewEvidenceRibbon", "AnalyticsDashboard", "AnalyticsFilterProvider", "GeointControlledSweepEngine", "GeointTemporalComparativeEngine", "DenueAnalyticalReviewPanel"];
  const requireLocal = (name: string): any => {
    if (name === "react") return react;
    if (name.endsWith("ProjectContext")) return { useProject: () => ({ project, album: [], updateProjectDetails, registerSweep: writes, persistHistoricalGeographyReconciliationForProject: writes }) };
    if (name.endsWith("AuthContext")) return { useAuth: () => ({ user: null }) };
    if (name.endsWith("projectRootReconciliation")) return { compactFindingRef };
    if (name.endsWith("geointGovernance")) return { GeointGovernanceStatus: { APPROVED_EVIDENCE: "APPROVED_EVIDENCE" } };
    if (name.endsWith("geographicEntityService")) return { getGeographicEntities: async () => [], saveGeographicEntity: writes, deleteGeographicEntity: writes, updateGeographicEntityMetadata: writes };
    if (name.endsWith("inSituPhotoCanonicalAdapter")) return { isExplicitInSituPhoto: () => false };
    if (name.endsWith("canonicalProjectGeography")) return {};
    if (name.endsWith("temporalComparisonBridge")) return {};
    return { default: name, ...Object.fromEntries(componentNames.map(key => [key, key])) };
  };
  const moduleRecord = { exports: {} as any };
  new Function("require", "module", "exports", output)(requireLocal, moduleRecord, moduleRecord.exports);
  return {
    project, updateProjectDetails, writes,
    async render() {
      cursor = 0; elements.length = 0;
      moduleRecord.exports.GeographicWorkspace();
      pending.splice(0).forEach(effect => effect());
      await new Promise(resolve => setImmediate(resolve));
    },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
    denuePanel() { return elements.find(element => element.type === "DenueAnalyticalReviewPanel"); },
    findingPanel() { return elements.find(element => element.type === "StreetViewFindingsPanel"); },
  };
}

describe("GeographicWorkspace read-only lifecycle", () => {
  const originalFetch = global.fetch;
  beforeEach(() => { global.fetch = jest.fn(async () => ({ ok: true, json: async () => [approved] })) as any; });
  afterEach(() => { global.fetch = originalFetch; });

  test.each([{ refs: [] }, { refs: [compactFindingRef(approved)] }])("mount, rerender and tab remount never write (refs=%j)", async ({ refs }) => {
    for (let mount = 0; mount < 2; mount++) {
      const instance = host(refs);
      await instance.render();
      await instance.render();
      expect(instance.denuePanel().props.streetViewFindings).toEqual([approved]);
      instance.project.approvedFindingRefs = [{ findingId: "changed" }];
      await instance.render();
      expect(instance.updateProjectDetails).not.toHaveBeenCalled();
      expect(instance.writes).not.toHaveBeenCalled();
      instance.unmount();
    }
  });

  test("explicit approval still persists compact refs; pending finding does not", async () => {
    const instance = host([{ findingId: "old" }]);
    await instance.render();
    await instance.findingPanel().props.onFindingCreated({ id: "pending", estado: "PENDING" });
    expect(instance.updateProjectDetails).not.toHaveBeenCalled();
    await instance.findingPanel().props.onFindingCreated(approved);
    expect(instance.updateProjectDetails).toHaveBeenCalledWith({ approvedFindingRefs: [{ findingId: "old" }, compactFindingRef(approved)] });
    instance.unmount();
  });
});
