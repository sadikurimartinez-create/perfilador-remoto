import { resolveCrimeDatasetCorpusMembership as resolve, CrimeDatasetCorpusCandidate } from "../src/utils/crimeDatasetCorpusMembership";
import type { CrimeDatasetCorpusQueryScope } from "../src/types/crimeDatasetCorpusIdentity";
const scope: CrimeDatasetCorpusQueryScope = { functionalScope: "INCIDENCE", geographicReference: "territory:fixture",
  temporalFilters: { start: null, end: null }, incidentTypes: [] };
function candidate(id: string, year: string): CrimeDatasetCorpusCandidate {
  return { datasetId: id, datasetName: "Official", datasetVersion: "v1", sourceOrganization: "Institution",
    provenanceStatus: "VERIFIED", institutionalRegistryReference: `registry:${id}`, temporalStart: `${year}-01-01`, temporalEnd: `${year}-12-31`,
    functionalScope: "INCIDENCE", incidentTypes: null, geographicReferences: null };
}
describe("ADR02231 pure membership", () => {
  test("one verified dataset", () => expect(resolve([candidate("a","2024")],scope).componentCount).toBe(1));
  test("two verified datasets without temporal filter", () => expect(resolve([candidate("a","2024"),candidate("b","2026")],scope).componentCount).toBe(2));
  test.each([["2024","a"],["2026","b"]])("temporal filter selects %s", (year,id) => {
    const r=resolve([candidate("a","2024"),candidate("b","2026")],{...scope,temporalFilters:{start:year+"-01-01",end:year+"-12-31"}});
    expect(r.status).toBe("RESOLVED"); expect(r.eligibleComponents.map(c=>c.datasetId)).toEqual([id]);
  });
  test("temporal filter intersects both", () => expect(resolve([candidate("a","2024"),candidate("b","2026")],
    {...scope,temporalFilters:{start:"2024-06-01",end:"2026-06-01"}}).componentCount).toBe(2));
  test("distinct IDs identical metadata retained", () => expect(resolve([candidate("a","2024"),candidate("b","2024")],scope).componentCount).toBe(2));
  test("order independent", () => { const c=[candidate("b","2026"),candidate("a","2024")];expect(resolve(c,scope)).toEqual(resolve([...c].reverse(),scope)); });
  test("temporal gap retained", () => expect(resolve([candidate("a","2024"),candidate("b","2026")],scope).temporalResolution)
    .toEqual([{datasetId:"a",start:"2024-01-01",end:"2024-12-31"},{datasetId:"b",start:"2026-01-01",end:"2026-12-31"}]));
  test.each([
    ["not verified",{provenanceStatus:"REGISTERED"}], ["missing ID",{datasetId:null}],
    ["missing registry",{institutionalRegistryReference:null}], ["missing metadata",{datasetName:null}],
    ["reversed interval",{temporalStart:"2027-01-01"}], ["missing temporal",{temporalStart:null}],
    ["unknown functional scope",{functionalScope:null}],
  ])("rejects %s", (_name,patch) => { const r=resolve([{...candidate("a","2024"),...(patch as object)}],scope);
    expect(r.status).toBe("INVALID");expect(r.rejectedCandidates).toHaveLength(1); });
  test("contradictory same ID metadata",()=>expect(resolve([candidate("a","2024"),{...candidate("a","2024"),datasetVersion:"other"}],scope).status).toBe("INVALID"));
  test("contradictory registry references",()=>expect(resolve([candidate("a","2024"),{...candidate("a","2024"),institutionalRegistryReference:"other"}],scope).status).toBe("INVALID"));
  test("invalid query temporal order",()=>expect(resolve([candidate("a","2024")],{...scope,temporalFilters:{start:"2026-01-01",end:"2024-01-01"}}).status).toBe("INVALID"));
  test("missing candidate temporal with filter fails closed",()=>expect(resolve([{...candidate("a","2024"),temporalEnd:null}],
    {...scope,temporalFilters:{start:"2024-01-01",end:null}}).status).toBe("INVALID"));
  test("invalid relevant candidate cannot hide behind valid component",()=>{ const r=resolve([candidate("a","2024"),{...candidate("b","2026"),provenanceStatus:"REGISTERED"}],scope);
    expect(r.componentCount).toBe(1);expect(r.status).toBe("INVALID"); });
  test("unknown incident type applicability fails closed",()=>expect(resolve([candidate("a","2024")],{...scope,incidentTypes:["TYPE"]}).status).toBe("INVALID"));
  test("accredited incident type exclusion",()=>expect(resolve([{...candidate("a","2024"),incidentTypes:["OTHER"]}],{...scope,incidentTypes:["TYPE"]}).componentCount).toBe(0));
  test("known geographic applicability exclusion",()=>expect(resolve([{...candidate("a","2024"),geographicReferences:["different"]}],scope).componentCount).toBe(0));
  test.each([0,4])("independent of incidental data length %i",length=>{ const c=[candidate("a","2024")]; const extra={...scope,data:Array(length).fill({})}; expect(resolve(c,extra)).toEqual(resolve(c,scope)); });
  test.each([1,500])("independent of LIMIT %i",limit=>{ const c=[candidate("a","2024")]; const extra={...scope,limit};expect(resolve(c,extra)).toEqual(resolve(c,scope)); });
});
