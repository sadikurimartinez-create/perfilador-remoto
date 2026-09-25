import fs from "node:fs";
import path from "node:path";

const workspacePath = path.join(
  process.cwd(),
  "src/components/cabinet/CabinetIndividualWorkspace.tsx"
);
const workspace = fs.readFileSync(workspacePath, "utf8");
const projectList = fs.readFileSync(
  path.join(process.cwd(), "src/components/ProjectList.tsx"),
  "utf8"
);

describe("Phase C1 - Cabinet individual local workspace", () => {
  test("workspace exists and reuses the governed Street View picker", () => {
    expect(fs.existsSync(workspacePath)).toBe(true);
    expect(workspace).toContain('import { StreetViewPanoramaPicker } from "@/modules/streetView/streetViewPanoramaPicker"');
    expect(workspace).toContain("<StreetViewPanoramaPicker");
    expect(workspace).toContain("StreetViewCapturePayload");
  });

  test("workspace has no project creation, evidence mapping, or persistence access", () => {
    expect(workspace).not.toContain("createProject");
    expect(workspace).not.toContain("mapStreetViewToAlbumPhoto");
    expect(workspace).not.toMatch(/firebase|firestore|storage/i);
    expect(workspace).not.toContain("useProject");
  });

  test("territorial point remains distinct from Google panorama coordinates", () => {
    expect(workspace).toContain("lat={candidate.lat}");
    expect(workspace).toContain("lng={candidate.lng}");
    expect(workspace).toContain("candidate.lat.toFixed(6)");
    expect(workspace).toContain("candidate.lng.toFixed(6)");
    expect(workspace).toContain("capture.panoramaLat.toFixed(6)");
    expect(workspace).toContain("capture.panoramaLng.toFixed(6)");
  });

  test("ProjectList mounts individual workspace only for CABINET individual", () => {
    expect(projectList).toContain(
      'projectCreationMode === "CABINET" && cabinetGeometryType === "individual"'
    );
    expect(projectList).toContain("<CabinetIndividualWorkspace");
  });

  test("polygon Cabinet mode remains isolated from the Individual workspace", () => {
    expect(projectList).toContain(
      'projectCreationMode === "CABINET" && cabinetGeometryType === "poligono"'
    );
    expect(projectList).toContain("<CabinetPolygonWorkspace");
  });
});
