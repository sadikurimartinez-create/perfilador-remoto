import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

type PersistAdditionalEvidenceFiles = (params: {
  files: File[];
  context: string;
  isReadOnly: boolean;
  uploadDocument: (file: File, context: string) => Promise<void>;
  setIsUploading: (isUploading: boolean) => void;
  clearError: () => void;
  onSuccess: () => void;
  onError: (message: string, failedFiles?: File[]) => void;
}) => Promise<boolean>;

const photoAlbumPath = path.join(process.cwd(), "src", "components", "PhotoAlbum.tsx");
const sourceText = fs.readFileSync(photoAlbumPath, "utf8");
const sourceFile = ts.createSourceFile(
  photoAlbumPath,
  sourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);

function findFunction(name: string): ts.FunctionDeclaration {
  let match: ts.FunctionDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) match = node;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (!match) throw new Error(`No se encontró la función ${name}`);
  return match;
}

function loadPersistenceFunction(): PersistAdditionalEvidenceFiles {
  const functionNode = findFunction("persistAdditionalEvidenceFiles");
  const compiled = ts.transpileModule(`export ${functionNode.getText(sourceFile)}`, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const moduleRef = { exports: {} as Record<string, unknown> };
  new Function("module", "exports", compiled)(moduleRef, moduleRef.exports);
  return moduleRef.exports.persistAdditionalEvidenceFiles as PersistAdditionalEvidenceFiles;
}

function deferred(): { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void } {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("E2E-006 persistencia de Evidencias Adicionales", () => {
  const persistAdditionalEvidenceFiles = loadPersistenceFunction();
  const files = [
    { name: "declaracion.pdf" },
    { name: "audio.mp3" },
  ] as File[];

  test("persiste cada archivo con el contexto normalizado y limpia sólo al concluir con éxito", async () => {
    const firstUpload = deferred();
    const secondUpload = deferred();
    const uploadDocument = jest
      .fn<Promise<void>, [File, string]>()
      .mockImplementationOnce(() => firstUpload.promise)
      .mockImplementationOnce(() => secondUpload.promise);
    let selectedFiles = files;
    const loadingStates: boolean[] = [];
    const clearError = jest.fn();
    const onError = jest.fn();

    const operation = persistAdditionalEvidenceFiles({
      files,
      context: "  Contexto pericial común  ",
      isReadOnly: false,
      uploadDocument,
      setIsUploading: (value) => loadingStates.push(value),
      clearError,
      onSuccess: () => {
        selectedFiles = [];
      },
      onError,
    });

    expect(uploadDocument).toHaveBeenCalledTimes(2);
    expect(selectedFiles).toBe(files);
    expect(loadingStates).toEqual([true]);

    firstUpload.resolve();
    await Promise.resolve();
    expect(selectedFiles).toBe(files);
    expect(loadingStates).toEqual([true]);

    secondUpload.resolve();
    await expect(operation).resolves.toBe(true);

    expect(uploadDocument.mock.calls).toEqual([
      [files[0], "Contexto pericial común"],
      [files[1], "Contexto pericial común"],
    ]);
    expect(selectedFiles).toEqual([]);
    expect(clearError).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(loadingStates).toEqual([true, false]);
  });

  test("en éxito parcial conserva sólo el archivo fallido e informa el resultado", async () => {
    const uploadDocument = jest
      .fn<Promise<void>, [File, string]>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Storage no disponible"));
    let selectedFiles = files;
    const loadingStates: boolean[] = [];
    const onError = jest.fn();

    const result = await persistAdditionalEvidenceFiles({
      files,
      context: "Contexto operativo",
      isReadOnly: false,
      uploadDocument,
      setIsUploading: (value) => loadingStates.push(value),
      clearError: jest.fn(),
      onSuccess: () => {
        selectedFiles = [];
      },
      onError: (message, failedFiles) => {
        selectedFiles = failedFiles ?? selectedFiles;
        onError(message, failedFiles);
      },
    });

    expect(result).toBe(false);
    expect(selectedFiles).toEqual([files[1]]);
    expect(selectedFiles).not.toContain(files[0]);
    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining("Carga parcial: 1 archivo(s) se guardaron y 1 fallaron"),
      [files[1]]
    );
    expect(loadingStates).toEqual([true, false]);
  });

  test("en fallo total conserva todos los archivos para reintento", async () => {
    const uploadDocument = jest
      .fn<Promise<void>, [File, string]>()
      .mockRejectedValueOnce(new Error("Fallo PDF"))
      .mockRejectedValueOnce(new Error("Fallo audio"));
    let selectedFiles = files;
    const loadingStates: boolean[] = [];
    const onError = jest.fn();

    const result = await persistAdditionalEvidenceFiles({
      files,
      context: "Contexto operativo",
      isReadOnly: false,
      uploadDocument,
      setIsUploading: (value) => loadingStates.push(value),
      clearError: jest.fn(),
      onSuccess: () => {
        selectedFiles = [];
      },
      onError: (message, failedFiles) => {
        selectedFiles = failedFiles ?? selectedFiles;
        onError(message, failedFiles);
      },
    });

    expect(result).toBe(false);
    expect(selectedFiles).toEqual(files);
    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining("Todos permanecen preparados para reintento"),
      files
    );
    expect(loadingStates).toEqual([true, false]);
  });

  test("el flujo está conectado a uploadDocument sin implementar Storage o Firestore", () => {
    const functionNode = findFunction("persistAdditionalEvidenceFiles");
    const identifiers = new Set<string>();
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node)) identifiers.add(node.text);
      ts.forEachChild(node, visit);
    };
    visit(functionNode);

    expect(identifiers).toContain("uploadDocument");
    expect(identifiers).not.toContain("getStorage");
    expect(identifiers).not.toContain("uploadBytes");
    expect(identifiers).not.toContain("getDownloadURL");
    expect(identifiers).not.toContain("getDb");
    expect(identifiers).not.toContain("addDoc");

    const wiringCall = sourceFile.statements
      .flatMap((statement) => {
        const calls: ts.CallExpression[] = [];
        const collect = (node: ts.Node) => {
          if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === "persistAdditionalEvidenceFiles"
          ) {
            calls.push(node);
          }
          ts.forEachChild(node, collect);
        };
        collect(statement);
        return calls;
      })
      .find((call) => call.arguments.length === 1 && ts.isObjectLiteralExpression(call.arguments[0]));

    expect(wiringCall).toBeDefined();
    const wiringObject = wiringCall!.arguments[0] as ts.ObjectLiteralExpression;
    const wiring = new Map<string, string>();
    for (const property of wiringObject.properties) {
      if (ts.isPropertyAssignment(property)) {
        wiring.set(property.name.getText(sourceFile), property.initializer.getText(sourceFile));
      } else if (ts.isShorthandPropertyAssignment(property)) {
        wiring.set(property.name.text, property.name.text);
      }
    }
    expect(wiring.get("files")).toBe("docFiles");
    expect(wiring.get("context")).toBe("docContext");
    expect(wiring.get("uploadDocument")).toBe("uploadDocument");
  });
});
