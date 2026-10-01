import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

function provider() {
  const connect = jest.fn(async () => undefined);
  const disconnect = jest.fn(async () => undefined);
  const push = jest.fn();
  const react = {
    createContext: () => ({ Provider: "Provider" }),
    useState: (initial: any) => [initial, jest.fn()],
    useRef: () => ({ current: 0 }), useEffect: jest.fn(),
    createElement: (_type: any, props: any) => props,
  };
  const source = fs.readFileSync(path.join(process.cwd(), "src/context/AuthContext.tsx"), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  const record = { exports: {} as any };
  new Function("require", "module", "exports", "React", output)((name: string) => {
    if (name === "react") return react;
    if (name === "next/navigation") return { useRouter: () => ({ push }) };
    if (name.endsWith("institutionalFirebaseClientBridge")) return { connectInstitutionalFirebase: connect, disconnectInstitutionalFirebase: disconnect };
    throw new Error(name);
  }, record, record.exports, react);
  return { auth: record.exports.AuthProvider({ children: null }).value, connect, disconnect, push };
}

describe("AuthContext Firebase wiring", () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    (global as any).window = { localStorage: { setItem: jest.fn(), removeItem: jest.fn() } };
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ id: 42, username: "fixture", role: "USER" }) })) as any;
  });
  afterEach(() => { global.fetch = originalFetch; delete (global as any).window; });
  test("institutional login connects Firebase before navigation", async () => {
    const p = provider(); await p.auth.login("fixture", "mock-password");
    expect(p.connect).toHaveBeenCalledTimes(1); expect(p.push).toHaveBeenCalledWith("/");
  });
  test("institutional logout disconnects Firebase and clears local identity", async () => {
    const p = provider(); await p.auth.logout();
    expect(p.disconnect).toHaveBeenCalledTimes(1);
    expect(window.localStorage.removeItem).toHaveBeenCalledWith("perfilador.currentUser");
    expect(p.push).toHaveBeenCalledWith("/login");
  });
  test("refresh without institutional session disconnects Firebase", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 401 })) as any;
    const p = provider(); await p.auth.refreshUser(); expect(p.disconnect).toHaveBeenCalledTimes(1);
  });
});
