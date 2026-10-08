import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { readFileSync } from 'fs';

const source = readFileSync('src/modules/pandillas/components/PandillasGisViewport.tsx', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const componentModule = { exports: {} as any };
new Function('require', 'module', 'exports', compiled)(require, componentModule, componentModule.exports);
const { PandillasGisViewport } = componentModule.exports;

test('normal viewport exposes expansion and preserves map content in a bounded full-width canvas', () => {
  const html = renderToStaticMarkup(React.createElement(PandillasGisViewport, { map: null }, React.createElement('div', { id: 'map-fixture' })));
  expect(html).toContain('AMPLIAR MAPA');
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain('aria-controls="gis-tactical-viewport"');
  expect(html).toContain('id="map-fixture"');
  expect(html).toContain('h-[70vh]');
  expect(html).toContain('min-w-0');
});

test('browser expansion, Escape, restoration and resizing retain the mounted map and live camera', async () => {
  const { spawn } = require('child_process');
  const script = `
    const puppeteer = require('puppeteer-core');
    const fs = require('fs');
    const ts = require('typescript');
    const assert = require('node:assert/strict');
    (async () => {
      const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox', '--disable-gpu'] });
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.addScriptTag({ path: require('path').join(require('path').dirname(require.resolve('react/package.json')), 'umd/react.development.js') });
        await page.addScriptTag({ path: require('path').join(require('path').dirname(require.resolve('react-dom/package.json')), 'umd/react-dom.development.js') });
        const source = fs.readFileSync('src/modules/pandillas/components/PandillasGisViewport.tsx', 'utf8');
        const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
        await page.evaluate(code => {
          const module = { exports: {} };
          new Function('require', 'module', 'exports', code)(() => window.React, module, module.exports);
          window.resizes = 0; window.camera = { lat: 21, lng: -102 }; window.zoom = 17;
          window.google = { maps: { event: { trigger: () => window.resizes++ } } };
          const map = { getCenter: () => window.camera, getZoom: () => window.zoom, setCenter: c => window.camera = c, setZoom: z => window.zoom = z };
          document.body.style.overflow = 'auto';
          const root = document.createElement('div'); document.body.append(root);
          window.ReactDOM.createRoot(root).render(window.React.createElement(module.exports.PandillasGisViewport, { map }, window.React.createElement('div', { id: 'map-fixture' })));
        }, code);
        await page.waitForSelector('button');
        await page.evaluate(() => window.originalMapNode = document.querySelector('#map-fixture'));
        await page.click('button');
        await page.waitForFunction(() => document.querySelector('button').getAttribute('aria-expanded') === 'true');
        assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.querySelector('button').getAttribute('aria-expanded') === 'false');
        assert.equal(await page.evaluate(() => document.body.style.overflow), 'auto');
        await page.click('button'); await page.click('button');
        await page.setViewport({ width: 390, height: 844 });
        await page.waitForFunction(() => window.resizes > 0);
        assert.deepEqual(await page.evaluate(() => ({ same: window.originalMapNode === document.querySelector('#map-fixture'), zoom: window.zoom, camera: window.camera, overflow: document.body.style.overflow })), { same: true, zoom: 17, camera: { lat: 21, lng: -102 }, overflow: 'auto' });
      } finally { await browser.close(); }
    })().catch(e => { console.error(e); process.exitCode = 1; });
  `;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', script], { cwd: process.cwd(), windowsHide: true });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => output += chunk);
    child.stderr.on('data', (chunk: Buffer) => output += chunk);
    child.on('error', reject);
    child.on('exit', (code: number) => code === 0 ? resolve() : reject(new Error(output)));
  });
}, 60000);
