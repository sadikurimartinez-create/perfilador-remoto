import { spawnSync } from "node:child_process";

describe("Firebase token route CommonJS compatibility", () => {
  test("real transitive imports load without require(esm) or network access", () => {
    const script = String.raw`
      const fs = require('node:fs');
      const path = require('node:path');
      const Module = require('node:module');
      const ts = require('typescript');
      let networkCalls = 0;
      const denyNetwork = () => { networkCalls++; throw new Error('NETWORK_FORBIDDEN'); };
      global.fetch = denyNetwork;
      for (const name of ['node:http', 'node:https']) {
        const transport = require(name);
        transport.request = denyNetwork;
        transport.get = denyNetwork;
      }
      const load = Module._load;
      const resolve = Module._resolveFilename;
      // Next's server-only marker is framework-resolved; neutralize only that marker.
      Module._load = function(name, ...args) {
        if (name === 'server-only') return {};
        return load.call(this, name, ...args);
      };
      Module._resolveFilename = function(name, ...args) {
        if (name.startsWith('@/')) name = path.join(process.cwd(), 'src', name.slice(2));
        return resolve.call(this, name, ...args);
      };
      Module._extensions['.ts'] = function(module, filename) {
        const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
        }).outputText;
        module._compile(output, filename);
      };
      const route = require('./src/app/api/auth/firebase-token/route.ts');
      if (typeof route.POST !== 'function' || route.runtime !== 'nodejs') throw new Error('ROUTE_INVALID');
      // Exercise the actual jwks-rsa/jose API with a generated public-key fixture.
      const { publicKey } = require('node:crypto').generateKeyPairSync('rsa', { modulusLength: 2048 });
      const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'fixture', alg: 'RS256', use: 'sig' };
      require('jwks-rsa/src/utils').retrieveSigningKeys([jwk]).then(keys => {
        if (keys.length !== 1 || !keys[0].getPublicKey().includes('BEGIN PUBLIC KEY')) throw new Error('JWKS_API_INCOMPATIBLE');
        if (networkCalls !== 0) throw new Error('NETWORK_USED');
        console.log('ROUTE_CJS_IMPORT_PASS;JWKS_PUBLIC_KEY_PASS;NETWORK_CALLS=0');
      }).catch(() => process.exit(1));
    `;
    const result = spawnSync(process.execPath, ["--no-experimental-require-module", "-e", script], {
      cwd: process.cwd(), encoding: "utf8", timeout: 30000,
    });
    expect(result.error).toBeUndefined();
    expect(result.stderr).not.toContain("ERR_REQUIRE_ESM");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ROUTE_CJS_IMPORT_PASS;JWKS_PUBLIC_KEY_PASS;NETWORK_CALLS=0");
  }, 35000);
});
