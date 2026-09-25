import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/ProjectList.tsx"),
  "utf8"
);

function sourceBetween(start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);

  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("Phase B1 - Project creation mode selector", () => {
  test("IN SITU keeps the existing productive creation flow", () => {
    const inSituHandler = sourceBetween(
      "const handleNuevoProyecto = () => {",
      "const handleGeometryTypeChange"
    );

    expect(source).toContain("Seleccione la modalidad de levantamiento");
    expect(source).toContain("onClick={handleNuevoProyecto}");
    expect(inSituHandler).toContain('setProjectCreationMode("IN_SITU")');
    expect(inSituHandler).toContain("setShowPrompt(true)");
    expect(source).toContain("const handleConfirmarNombre = async () => {");
    expect(source).toContain("const newId = await createProject({");
  });

  test("the selector exposes IN SITU and GABINETE", () => {
    const selector = sourceBetween(
      ") : showCreationModeSelection ? (",
      ') : projectCreationMode === "CABINET" && !cabinetGeometryType ? ('
    );

    expect(selector).toContain("IN SITU");
    expect(selector).toContain("GABINETE");
  });

  test("GABINETE remains isolated from creation, geography draft, and photos", () => {
    const cabinetHandlers = sourceBetween(
      "const handleSelectCabinet = () => {",
      "const handleNuevoProyecto = () => {"
    );

    expect(cabinetHandlers).not.toContain("createProject");
    expect(cabinetHandlers).not.toContain("setDraftGeography");
    expect(cabinetHandlers).not.toContain("pendingPhotos");
    expect(source).toContain("<CabinetPolygonWorkspace");
  });

  test("the existing duplicate-creation guard remains intact", () => {
    expect(source).toContain("const isCreatingProjectRef = useRef(false)");
    expect(source).toContain("if (isCreatingProjectRef.current) return");
    expect(source).toContain("isCreatingProjectRef.current = true");
  });
});
