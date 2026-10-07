import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
jest.mock('../src/modules/pandillas/components/GangOrganizationPrintView.module.css', () => ({ __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }));
import { GangOrganizationPages, createGangOrganizationSnapshot, organizationPages, getGangRoleVisualStyle, GANG_ROLE_OPTIONS, waitForPrintableImages, printGangOrganization } from '../src/modules/pandillas/components/GangOrganizationPrintView';
import type { GangMember } from '../src/modules/pandillas/pandillas.mapper';
const member = (status?: GangMember['estatusPandilla']): GangMember => ({ nombre: 'Nombre documental', alias: 'Alias documental', rol: '', estatusPandilla: status });
const snapshot = (members = [member()]) => createGangOrganizationSnapshot('Pandilla documental', members, ['https://example.test/primary.jpg'], '07/10/2026');
const render = (members = [member()]) => renderToStaticMarkup(<GangOrganizationPages snapshot={snapshot(members)} />);
test('nombre de pandilla', () => expect(render()).toContain('Pandilla documental'));
test('total', () => expect(render()).toContain('1 integrantes'));
test('nombre y alias', () => { expect(render()).toContain('Nombre documental'); expect(render()).toContain('Alias documental'); });
test('liderazgo explícito', () => expect(render([member('Líder')])).toContain('<h2>Liderazgo</h2>'));
test('sin liderazgo inventado', () => expect(render()).not.toContain('<h2>Liderazgo</h2>'));
test('Sicario especial', () => { expect(render([member('Sicario')])).toContain('card sicario'); expect(render([member('Sicario')])).toContain('SICARIO'); });
test.each(['Narcomenudista','Halcón','Chofer'] as const)('muestra %s', status => expect(render([member(status)])).toContain(status));
test('función no registrada', () => expect(render()).toContain('Función no registrada'));
test('no asigna Integrante', () => expect(snapshot().members[0].estatusPandilla).toBeUndefined());
test('PRIMARY antes de legacy', () => { const m = member(); m.fotografiaUrl = '/legacy.jpg'; expect(render([m])).toContain('src="https://example.test/primary.jpg"'); expect(render([m])).not.toContain('src="/legacy.jpg"'); });
test('fallback legacy', () => { const m = member(); m.fotografiaUrl = '/legacy.jpg'; const s = createGangOrganizationSnapshot('Gang',[m],[]); expect(renderToStaticMarkup(<GangOrganizationPages snapshot={s} />)).toContain('src="/legacy.jpg"'); });
test('fotografía ausente', () => expect(renderToStaticMarkup(<GangOrganizationPages snapshot={createGangOrganizationSnapshot('Gang',[member()],[])} />)).toContain('Fotografía no disponible'));
test('múltiples miembros paginados sin pérdidas', () => { const s = snapshot(Array.from({length: 19}, () => member())); expect(organizationPages(s)).toHaveLength(5); expect(organizationPages(s).flatMap(p => p.members)).toHaveLength(19); });
test('sin controles editables', () => expect(render()).not.toMatch(/<(input|select|textarea|form)\b/));
test('no muta datos recibidos ni requiere persistencia al renderizar', () => { const m = Object.freeze(member()); expect(() => render([m])).not.toThrow(); expect(m.estatusPandilla).toBeUndefined(); });
test('snapshot independiente del estado posterior', () => { const m = member(); const s = snapshot([m]); m.nombre = 'Cambiado'; expect(renderToStaticMarkup(<GangOrganizationPages snapshot={s} />)).toContain('Nombre documental'); expect(s.members[0].nombre).not.toBe('Cambiado'); });
test('vacío', () => expect(render([])).toContain('Sin integrantes registrados'));
test('catálogo completo sin duplicados', () => { expect(GANG_ROLE_OPTIONS).toHaveLength(18); expect(new Set(GANG_ROLE_OPTIONS).size).toBe(18); });
test('rol desconocido neutro', () => expect(getGangRoleVisualStyle('valor legacy')).toBe('neutral'));
test('segundo al mando explícito', () => expect(render([member('Segundo al mando')])).toContain('<h2>Liderazgo</h2>'));
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

test.each(['success', 'cancel', 'error'] as const)('print mode restores body after %s', outcome => {
  const classes = new Set(['existing-class']);
  const body = { classList: { add: (name: string) => classes.add(name), remove: (name: string) => classes.delete(name) } } as unknown as HTMLElement;
  const events = new EventTarget();
  const printer = Object.assign(events, { print: jest.fn(() => {
    expect(classes.has('printMode')).toBe(true);
    if (outcome === 'error') throw new Error('PRINT_FAILED');
    events.dispatchEvent(new Event('afterprint'));
    expect(classes.has('printMode')).toBe(false);
  }) });
  if (outcome === 'error') expect(() => printGangOrganization(body, printer)).toThrow('PRINT_FAILED');
  else { printGangOrganization(body, printer); printGangOrganization(body, printer); expect(printer.print).toHaveBeenCalledTimes(2); }
  expect([...classes]).toEqual(['existing-class']);
});
test('print mode restores body even without afterprint', () => {
  const classes = new Set<string>();
  const body = { classList: { add: (name: string) => classes.add(name), remove: (name: string) => classes.delete(name) } } as unknown as HTMLElement;
  const printer = Object.assign(new EventTarget(), { print: () => expect(classes.has('printMode')).toBe(true) });
  printGangOrganization(body, printer);
  expect(classes.size).toBe(0);
});