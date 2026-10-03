import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "fs";
import { resolve } from "path";
import ts from "typescript";

// Execute the real TSX with controlled hooks, without changing Jest's JSX setup.
function harness(readOnly = false) {
  const slots: any[] = [];
  let cursor = 0;
  const context = {
    project: { id: "pilot", hipotesis: "  Texto legacy.\nSin precisiones.  " },
    isReadOnly: readOnly,
    saveHumanHypothesis: jest.fn(), updateProjectDetails: jest.fn(),
    certifyHypothesis: jest.fn(), generateReport: jest.fn(), runAI: jest.fn(),
  };
  const hooks = { ...React,
    useState: (initial: any) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value: any) => { slots[index] = value; }];
    },
    useRef: (initial: any) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect: () => { cursor++; },
  };
  const filename = resolve(__dirname, "../src/components/HumanHypothesisEditor.tsx");
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const record = { exports: {} as any };
  new Function("require", "module", "exports", output)((name: string) => {
    if (name === "react") return hooks;
    if (name === "@/context/ProjectContext") return { useProject: () => context };
    throw new Error(`Unexpected runtime dependency: ${name}`);
  }, record, record.exports);
  function render() {
    cursor = 0;
    const child = record.exports.HumanHypothesisEditor();
    return record.exports.HypothesisEditor(child.props) as React.ReactElement;
  }
  function find(tree: any, type: string): any {
    if (!tree || typeof tree !== "object") return undefined;
    if (tree.type === type) return tree;
    for (const child of React.Children.toArray(tree.props?.children)) {
      const match = find(child, type); if (match) return match;
    }
  }
  return { context, render, find };
}

test("shows the existing text and separates historical authorship from the new formulation", () => {
  const h = harness(); const tree = h.render();
  expect(h.find(tree, "textarea").props.value).toBe(h.context.project.hipotesis);
  const html = renderToStaticMarkup(tree);
  expect(html).toContain("autor no acreditado");
  expect(html).toContain("usuario autenticado");
  expect(h.find(tree, "textarea").props.spellCheck).toBe(false);
});

test("saves unchanged raw text once, disables pending input and consumes the canonical result", async () => {
  const h = harness();
  let finish!: (value: any) => void;
  h.context.saveHumanHypothesis.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const button = h.find(h.render(), "button");
  const pending = button.props.onClick();
  await button.props.onClick();
  expect(h.context.saveHumanHypothesis).toHaveBeenCalledTimes(1);
  expect(h.context.saveHumanHypothesis).toHaveBeenCalledWith(h.context.project.hipotesis);
  const during = h.render();
  expect(h.find(during, "button").props.disabled).toBe(true);
  expect(h.find(during, "textarea").props.disabled).toBe(true);
  finish({ text: h.context.project.hipotesis.trim(), version: 2,
    status: "FORMULATED", validationStatus: "UNREVIEWED" });
  await pending;
  const after = h.render();
  expect(h.find(after, "textarea").props.value).toBe(h.context.project.hipotesis.trim());
  expect(renderToStaticMarkup(after)).toContain("FORMULATED");
  expect(h.find(after, "button").props.disabled).toBe(true);
  await button.props.onClick();
  expect(h.context.saveHumanHypothesis).toHaveBeenCalledTimes(1);
  for (const action of [h.context.updateProjectDetails, h.context.certifyHypothesis,
    h.context.generateReport, h.context.runAI]) expect(action).not.toHaveBeenCalled();
});

test("passes human edits exactly without adding generated text", async () => {
  const h = harness(); const raw = "  Texto humano; puntuación intacta.\nSegunda línea.  ";
  h.find(h.render(), "textarea").props.onChange({ target: { value: raw } });
  h.context.saveHumanHypothesis.mockResolvedValue({ text: raw.trim(), version: 2 });
  await h.find(h.render(), "button").props.onClick();
  expect(h.context.saveHumanHypothesis).toHaveBeenCalledWith(raw);
});

test("an error reports uncertainty without any automatic retry", async () => {
  const h = harness(); h.context.saveHumanHypothesis.mockRejectedValue(new Error("offline"));
  await h.find(h.render(), "button").props.onClick();
  expect(renderToStaticMarkup(h.render())).toContain("Compruebe la hipótesis persistida");
  await Promise.resolve(); h.render();
  expect(h.context.saveHumanHypothesis).toHaveBeenCalledTimes(1);
});

test("read-only and empty text cannot invoke persistence even through the handler", async () => {
  const h = harness(true);
  expect(h.find(h.render(), "button").props.disabled).toBe(true);
  await h.find(h.render(), "button").props.onClick();
  expect(h.context.saveHumanHypothesis).not.toHaveBeenCalled();
  const writable = harness();
  writable.find(writable.render(), "textarea").props.onChange({ target: { value: "  " } });
  await writable.find(writable.render(), "button").props.onClick();
  expect(writable.context.saveHumanHypothesis).not.toHaveBeenCalled();
});

test("the production PhotoAlbum hypothesis section mounts the shared editor", () => {
  const source = readFileSync(resolve(__dirname, "../src/components/PhotoAlbum.tsx"), "utf8");
  const ast = ts.createSourceFile("PhotoAlbum.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let mounted = false;
  function visit(node: ts.Node) {
    if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(attribute =>
      ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === "id" &&
      attribute.initializer?.getText(ast) === '"report-readiness-hypothesis"')) {
      mounted = node.children.some(child => ts.isJsxSelfClosingElement(child) &&
        child.tagName.getText(ast) === "HumanHypothesisEditor");
    }
    ts.forEachChild(node, visit);
  }
  visit(ast); expect(mounted).toBe(true);
});
