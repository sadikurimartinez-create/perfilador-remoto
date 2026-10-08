import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
jest.mock('../src/modules/pandillas/components/GangOrganizationPrintView.module.css', () => ({ __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }));
import { GangOrganizationPages, createGangOrganizationSnapshot, organizationPages, getGangRoleVisualStyle, GANG_ROLE_OPTIONS, waitForPrintableImages, organizationPdfFilename, getOrganizationLayout, getOrganizationPreviewScale, organizationPageIndex, ORGANIZATION_LAYOUT_POLICY } from '../src/modules/pandillas/components/GangOrganizationPrintView';
import type { GangMember } from '../src/modules/pandillas/pandillas.mapper';
const member = (status?: GangMember['estatusPandilla']): GangMember => ({ nombre: 'Nombre documental', alias: 'Alias documental', rol: '', estatusPandilla: status });
const snapshot = (members = [member()]) => createGangOrganizationSnapshot('Pandilla documental', members, ['https://example.test/primary.jpg'], '07/10/2026');
const render = (members = [member()]) => renderToStaticMarkup(<GangOrganizationPages snapshot={snapshot(members)} />);
test('nombre de pandilla', () => expect(render()).toContain('Pandilla documental'));
test('total', () => expect(render()).toContain('1 integrantes'));
test('nombre y alias', () => { expect(render()).toContain('Nombre documental'); expect(render()).toContain('Alias documental'); });
test('liderazgo explícito documental', () => expect(render([member('Líder')])).toContain('Líder'));
test('sin liderazgo inventado', () => expect(render()).not.toContain('Líder'));
test('Sicario especial', () => { expect(render([member('Sicario')])).toContain('card sicario'); expect(render([member('Sicario')])).toContain('SICARIO'); });
test.each(['Narcomenudista','Halcón','Chofer'] as const)('muestra %s', status => expect(render([member(status)])).toContain(status));
test('función no registrada', () => expect(render()).toContain('Función no registrada'));
test('no asigna Integrante', () => expect(snapshot().members[0].estatusPandilla).toBeUndefined());
test('PRIMARY antes de legacy', () => { const m = member(); m.fotografiaUrl = '/legacy.jpg'; expect(render([m])).toContain('src="https://example.test/primary.jpg"'); expect(render([m])).not.toContain('src="/legacy.jpg"'); });
test('fallback legacy', () => { const m = member(); m.fotografiaUrl = '/legacy.jpg'; const s = createGangOrganizationSnapshot('Gang',[m],[]); expect(renderToStaticMarkup(<GangOrganizationPages snapshot={s} />)).toContain('src="/legacy.jpg"'); });
test('fotografía ausente', () => expect(renderToStaticMarkup(<GangOrganizationPages snapshot={createGangOrganizationSnapshot('Gang',[member()],[])} />)).toContain('Fotografía no disponible'));
test('múltiples miembros paginados sin pérdidas', () => { const s = snapshot(Array.from({length: 19}, () => member())); expect(organizationPages(s)).toHaveLength(2); expect(organizationPages(s).flatMap(p => p.members)).toHaveLength(19); });
test('sin controles editables', () => expect(render()).not.toMatch(/<(input|select|textarea|form)\b/));
test('no muta datos recibidos ni requiere persistencia al renderizar', () => { const m = Object.freeze(member()); expect(() => render([m])).not.toThrow(); expect(m.estatusPandilla).toBeUndefined(); });
test('snapshot independiente del estado posterior', () => { const m = member(); const s = snapshot([m]); m.nombre = 'Cambiado'; expect(renderToStaticMarkup(<GangOrganizationPages snapshot={s} />)).toContain('Nombre documental'); expect(s.members[0].nombre).not.toBe('Cambiado'); });
test('vacío', () => expect(render([])).toContain('Sin integrantes registrados'));
test('catálogo completo sin duplicados', () => { expect(GANG_ROLE_OPTIONS).toHaveLength(18); expect(new Set(GANG_ROLE_OPTIONS).size).toBe(18); });
test('rol desconocido neutro', () => expect(getGangRoleVisualStyle('valor legacy')).toBe('neutral'));
test('segundo al mando explícito', () => expect(render([member('Segundo al mando')])).toContain('Segundo al mando'));
test.each(['load', 'error'])('espera imagen hasta %s', async eventName => {
  const img = Object.assign(new EventTarget(), { complete: false });
  let finished = false;
  const promise = waitForPrintableImages({ querySelectorAll: () => [img] } as unknown as HTMLElement).then(() => { finished = true; });
  await Promise.resolve(); expect(finished).toBe(false);
  img.dispatchEvent(new Event(eventName)); await promise; expect(finished).toBe(true);
});
test('imagen bloqueada impide imprimir indefinidamente', async () => {
  jest.useFakeTimers();
  try {
    const img = Object.assign(new EventTarget(), { complete: false });
    const expectation = expect(waitForPrintableImages({ querySelectorAll: () => [img] } as unknown as HTMLElement)).rejects.toThrow('PRINT_IMAGE_TIMEOUT');
    jest.advanceTimersByTime(20000); await expectation;
  } finally { jest.useRealTimers(); }
});

test('PDF filename is descriptive and cannot inject paths or reserved characters', () => {
  const name = organizationPdfFilename('../../Los Género 14:<x>', new Date('2026-10-07T12:00:00Z'));
  expect(name).toBe('organigrama-Los-Genero-14-x-2026-10-07T12-00-00-000Z.pdf');
  expect(name).not.toMatch(/[\\/:<>|?*]/);
});
test('six members including documented leadership fit a single page', () => {
  const s = snapshot([member('Líder'), member('Segundo al mando'), member('Sicario'), member('Chofer'), member('Halcón'), member()]);
  expect(organizationPages(s)).toHaveLength(1);
  expect(organizationPages(s)[0].members).toHaveLength(6);
  expect(renderToStaticMarkup(<GangOrganizationPages snapshot={s} />)).toContain('repeat(3, minmax(0, 1fr))');
});
test.each(GANG_ROLE_OPTIONS)('printable badge renders documented category %s', status => {
  expect(render([member(status)])).toContain(status === 'Sicario' ? 'SICARIO' : status);
});
test('Sicario in rol also receives emphasized badge', () => {
  const m = { ...member(), rol: 'Sicario' };
  expect(render([m])).toContain('card sicario');
  expect(render([m])).toContain('SICARIO');
});
test('snapshot retains one resolved PRIMARY per member in order', () => {
  const s = createGangOrganizationSnapshot('Gang', [member(), { ...member(), nombre: 'Segundo' }], ['/one.jpg', '/two.jpg']);
  expect(s.members.map(m => m.primaryUrl)).toEqual(['/one.jpg', '/two.jpg']);
  expect(renderToStaticMarkup(<GangOrganizationPages snapshot={s} />)).toContain('src="/two.jpg"');
});
test.each([[1,1,1],[2,1,2],[4,1,2],[6,1,3],[7,1,3],[9,1,3],[12,1,4],[13,2,4],[24,2,4],[25,3,4]])('layout %i members: %i pages, %i initial columns', (count, expectedPages, columns) => {
  const members = Array.from({ length: count }, (_, i) => ({ ...member(GANG_ROLE_OPTIONS[i % 18]), nombre: `Persona ${i}`, alias: `Alias ${i}` }));
  const s = createGangOrganizationSnapshot('Gang', members, members.map((_, i) => `/photo-${i}.jpg`));
  const pages = organizationPages(s);
  expect(pages).toHaveLength(expectedPages);
  expect(pages[0].layout.columns).toBe(columns);
  const flattened = pages.flatMap(p => p.members);
  expect(flattened.map(m => m.nombre)).toEqual(members.map(m => m.nombre));
  expect(new Set(flattened.map(m => m.nombre)).size).toBe(count);
  expect(flattened.map(m => m.alias)).toEqual(members.map(m => m.alias));
  expect(flattened.map(m => m.primaryUrl)).toEqual(members.map((_, i) => `/photo-${i}.jpg`));
  expect(flattened.map(m => m.estatusPandilla)).toEqual(members.map(m => m.estatusPandilla));
  for (const page of pages) {
    expect(page.layout.cardWidth).toBeGreaterThanOrEqual(ORGANIZATION_LAYOUT_POLICY.minimumCardWidth);
    expect(page.layout.photoHeight).toBeGreaterThanOrEqual(ORGANIZATION_LAYOUT_POLICY.minimumPhotoHeight);
  }
  const html = renderToStaticMarkup(<GangOrganizationPages snapshot={s} />);
  expect((html.match(/<article/g) || []).length).toBe(count);
  expect(html).toContain(`Página ${pages.length} de ${pages.length}`);
});
test('long documentary texts lower density without truncation or changing order', () => {
  const members = Array.from({ length: 12 }, (_, i) => ({ ...member('Colaborador externo'), nombre: `Persona ${i} ${'Nombre largo '.repeat(8)}`, alias: 'Alias documental '.repeat(10), rol: 'Función documental '.repeat(8) }));
  const s = createGangOrganizationSnapshot('Gang', members, []);
  const pages = organizationPages(s);
  expect(pages[0].layout.capacity).toBeLessThan(12);
  expect(pages.flatMap(p => p.members).map(m => m.nombre)).toEqual(members.map(m => m.nombre));
  expect(renderToStaticMarkup(<GangOrganizationPages snapshot={s} />)).toContain(members[0].alias);
});
test('fit includes the complete physical page and zoom never changes layout', () => {
  const p = ORGANIZATION_LAYOUT_POLICY;
  const layout = getOrganizationLayout(snapshot().members);
  const scale = getOrganizationPreviewScale(900, 600);
  expect(p.width * scale).toBeLessThanOrEqual(900 - 32);
  expect(p.height * scale).toBeLessThanOrEqual(600 - 32);
  expect(getOrganizationPreviewScale(900, 600, 1.5)).toBeCloseTo(scale * 1.5);
  expect(getOrganizationLayout(snapshot().members)).toEqual(layout);
});
test('multipage navigation is bounded and can return to first page', () => {
  expect(organizationPageIndex(0, -1, 3)).toBe(0);
  expect(organizationPageIndex(0, 1, 3)).toBe(1);
  expect(organizationPageIndex(1, 1, 3)).toBe(2);
  expect(organizationPageIndex(2, 1, 3)).toBe(2);
  expect(organizationPageIndex(2, -1, 3)).toBe(1);
});

test('Chrome: complete preview, navigation, zoom, close, consecutive direct downloads and real PDF pagination', async () => {
  async function runBrowser(roles: readonly string[]) {
    const assert = require('node:assert/strict');
    const expect = (value: any) => ({ toBe: (expected: any) => assert.equal(value, expected), toContain: (expected: string) => assert.ok(value.includes(expected)), toBeNull: () => assert.equal(value, null) });
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const ts = require('typescript') as typeof import('typescript');
  const puppeteer = require('puppeteer-core') as typeof import('puppeteer-core');
  const executablePath = [process.env.CHROME_BIN, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter((p): p is string => !!p).find(p => fs.existsSync(p));
  if (!executablePath) throw new Error('BROWSER_VALIDATION_REQUIRES_CHROME_OR_EDGE');
  const componentPath = path.join(process.cwd(), 'src/modules/pandillas/components/GangOrganizationPrintView.tsx');
  const compiled = ts.transpileModule(fs.readFileSync(componentPath, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const css = fs.readFileSync(componentPath.replace('.tsx', '.module.css'), 'utf8').replace(/:global\(body\)/g, 'body');
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000 });
    for (const count of [1, 6, 9, 12, 25, 8]) {
      await page.goto('about:blank');
      await page.emulateMediaType('screen');
      await page.setContent(`<style>${css}</style><main id="app-around">GENERAL APPLICATION</main><div id="fixture"></div>`);
      await page.addScriptTag({ path: path.join(path.dirname(require.resolve('react')), 'umd/react.development.js') });
      await page.addScriptTag({ path: path.join(path.dirname(require.resolve('react-dom')), 'umd/react-dom.development.js') });
      await page.addScriptTag({ path: require.resolve('html2canvas') });
      await page.addScriptTag({ path: path.join(path.dirname(require.resolve('jspdf')), 'jspdf.umd.min.js') });
      await page.addScriptTag({ content: `var module = { exports: {} }; var exports = module.exports;
        function require(name) {
          if (name === 'react') return React;
          if (name === 'react-dom') return ReactDOM;
          if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, {get: (_, key) => String(key)}) };
          if (name.includes('CEIPOLButton')) return { CEIPOLButton: ({ children, loading, variant, ...props }) => React.createElement('button', {...props, disabled: props.disabled || loading}, children) };
          if (name === 'html2canvas') return { __esModule: true, default: window.html2canvas };
          if (name === 'jspdf') return window.jspdf;
          if (name.includes('dossierPhotoDisplay')) return { dossierPhotoSource: (primary, legacy, failed) => [primary, legacy].find(url => url && !failed.includes(url)) };
          throw new Error('UNEXPECTED_TEST_IMPORT');
        }
        ${compiled}
        window.fixtureExports = module.exports;` });
      const cdp = await page.createCDPSession();
      await cdp.send('Page.setDownloadBehavior', { behavior: 'deny' });
      const members = Array.from({ length: count }, (_, i) => ({ nombre: `Integrante documental ${i + 1}` + (count === 8 ? ' Nombre largo'.repeat(15) : ''), alias: `Alias ${i + 1}` + (count === 8 ? ' Alias documental'.repeat(10) : ''), estatusPandilla: roles[i % roles.length], edad: 25, rol: count === 8 ? 'Función documental '.repeat(8) : '' }));
      const portrait = await page.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 100;
        const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 0, 80, 100);
        ctx.fillStyle = '#64748b'; ctx.beginPath(); ctx.arc(40, 30, 18, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(10, 60, 60, 40);
        return canvas.toDataURL('image/png');
      });
      await page.evaluate(`window.fixtureClosed=false; window.fixturePdfs=[]; window.fixtureNames=[];
        window.print = () => { throw new Error('PRINT_MUST_NOT_BE_USED'); };
        const createUrl = URL.createObjectURL.bind(URL); URL.createObjectURL = blob => { if (blob.type === 'application/pdf') window.fixturePdfs.push(blob); return createUrl(blob); };
        const dispatch = EventTarget.prototype.dispatchEvent; EventTarget.prototype.dispatchEvent = function(event) { if (this instanceof HTMLAnchorElement && this.download) window.fixtureNames.push(this.download); return dispatch.call(this, event); };
        window.fixtureRoot = ReactDOM.createRoot(document.getElementById('fixture'));
        window.fixtureRoot.render(React.createElement(window.fixtureExports.GangOrganizationPrintView, {snapshot: window.fixtureExports.createGangOrganizationSnapshot('Pandilla ficticia', ${JSON.stringify(members)}, ${JSON.stringify(members.map(() => portrait))}, '07/10/2026'), onClose: () => { window.fixtureClosed=true; window.fixtureRoot.unmount(); }}));`);
      await page.waitForSelector('.page[data-active="true"]');
      await page.waitForFunction(() => Array.from(document.images).every(img => img.complete && img.naturalWidth > 0));
      await new Promise(resolve => setTimeout(resolve, 150));
      const geometry = await page.evaluate(() => {
        const container = document.querySelector('.viewport') as HTMLElement;
        const viewport = container.getBoundingClientRect();
        const sheet = document.querySelector('.page[data-active="true"]')!.getBoundingClientRect();
        return { noScroll: container.scrollWidth <= container.clientWidth + 1 && container.scrollHeight <= container.clientHeight + 1, fits: sheet.left >= viewport.left && sheet.right <= viewport.right && sheet.top >= viewport.top && sheet.bottom <= viewport.bottom,
          overflow: Array.from(document.querySelectorAll<HTMLElement>('article')).filter(card => card.scrollHeight > card.clientHeight + 1).length,
          physicalWidth: (document.querySelector('.page') as HTMLElement).offsetWidth };
      });
      expect(geometry.fits).toBe(true);
      expect(geometry.noScroll).toBe(true);
      expect(geometry.overflow).toBe(0);
      if (count === 6) {
        await page.setViewport({ width: 900, height: 650 });
        await new Promise(resolve => setTimeout(resolve, 150));
        expect(await page.evaluate(() => {
          const v = document.querySelector('.viewport') as HTMLElement;
          const bounds = v.getBoundingClientRect();
          const sheet = document.querySelector('.page[data-active="true"]')!.getBoundingClientRect();
          return sheet.left >= bounds.left && sheet.right <= bounds.right && sheet.top >= bounds.top && sheet.bottom <= bounds.bottom && v.scrollHeight <= v.clientHeight + 1 && v.scrollWidth <= v.clientWidth + 1;
        })).toBe(true);
        await page.setViewport({ width: 1400, height: 1000 });
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      const click = async (text: string) => { await page.evaluate((label: string) => { const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent === label); if (!button) throw new Error('BUTTON_NOT_FOUND'); button.click(); }, text); await new Promise(resolve => setTimeout(resolve, 50)); };
      await click('+');
      expect(await page.evaluate(() => (document.querySelector('.page') as HTMLElement).offsetWidth)).toBe(geometry.physicalWidth);
      await click('AJUSTAR');
      if (count === 25) {
        await click('Página siguiente →');
        expect(await page.evaluate(() => document.querySelector('.page[data-active="true"] .metadata')!.textContent)).toContain('Página 2 de 3');
        await click('← Página anterior');
      }
      expect(await page.evaluate(() => Array.from(document.querySelectorAll('button')).some(b => /IMPRIMIR/.test(b.textContent || '')))).toBe(false);
      await click('DESCARGAR ORGANIGRAMA');
      await page.waitForFunction('window.fixturePdfs.length === 1 && window.fixtureNames.length === 1 || document.querySelector("[role=alert]")');
      const alert = await page.evaluate(() => document.querySelector('[role=alert]')?.textContent);
      if (alert) {
        await page.evaluate('window.fixtureExports.downloadOrganizationPdf(document.querySelector(".document"), "Diagnostic fixture")');
        throw new Error(String(alert));
      }
      await click('DESCARGAR ORGANIGRAMA');
      await page.waitForFunction('window.fixturePdfs.length === 2 && window.fixtureNames.length === 2');
      expect(await page.$('[data-organization-pdf-scratch]')).toBeNull();
      const filename = await page.evaluate('window.fixtureNames[0]');
      expect(filename.startsWith('organigrama-Pandilla-ficticia-')).toBe(true);
      const bytes = await page.evaluate('window.fixturePdfs[0].arrayBuffer().then(buffer => Array.from(new Uint8Array(buffer)))');
      const pdf = Buffer.from(bytes as number[]);
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      const pageCount = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
      const expectedPages = count === 8 ? await page.evaluate(`window.fixtureExports.organizationPages(window.fixtureExports.createGangOrganizationSnapshot('Gang', ${JSON.stringify(members)}, [])).length`) : count === 25 ? 3 : 1;
      expect(pageCount).toBe(expectedPages);
      expect(pdf.toString('latin1').includes('/Subtype /Image')).toBe(true);
      if (process.env.ORGANIZATION_PDF_QA_DIR && [6, 12, 25].includes(count)) fs.writeFileSync(path.join(process.env.ORGANIZATION_PDF_QA_DIR, `organigrama-fixture-${count}.pdf`), pdf);
      if (count === 1) {
        await page.evaluate('window.fetch = () => Promise.reject(new Error("SIMULATED_PHOTO_FETCH_FAILURE"))');
        await click('DESCARGAR ORGANIGRAMA');
        await page.waitForSelector('[role=alert]');
        expect(await page.evaluate('window.fixturePdfs.length')).toBe(2);
        expect(await page.$('[data-organization-pdf-scratch]')).toBeNull();
      }
      await click('CERRAR');
      expect(await page.evaluate('window.fixtureClosed')).toBe(true);
      expect(await page.$('[data-gang-print-root]')).toBeNull();
    }
  } finally { await browser.close(); }
  }
  // Native Node subprocess isolates Puppeteer's ESM runtime from Jest's CommonJS loader.
  const script = `(${runBrowser.toString()})(${JSON.stringify(GANG_ROLE_OPTIONS)}).catch(error => { console.error(error); process.exitCode = 1; });`;
  await new Promise<void>((resolve, reject) => {
    const child = require('child_process').spawn(process.execPath, ['-e', script], { cwd: process.cwd(), windowsHide: true });
    let output = '';
    child.stdout.on('data', (data: Buffer) => { output += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { output += data.toString(); });
    child.on('error', reject);
    child.on('exit', (code: number) => code === 0 ? resolve() : reject(new Error(output || `BROWSER_TEST_EXIT_${code}`)));
  });
}, 180000);
