import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'fs';
import ts from 'typescript';
import { buildMemberDossierView, dossierValue, initialDossierConsultation, dossierConsultationTransition } from '../src/modules/pandillas/memberDossierView';
import { bindDossierPhotos, type DossierPhoto } from '../src/modules/pandillas/photo-evidence/dossierPhotoDisplay';
import type { GangMember } from '../src/modules/pandillas/pandillas.mapper';

// Compile the isolated presentation component using the project's React dependency; no DOM/network needed.
const source = readFileSync('src/modules/pandillas/components/MemberDossierConsultation.tsx', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const presentation: any = { exports: {} };
new Function('require', 'module', 'exports', compiled)((id: string) => id === '../memberDossierView' ? require('../src/modules/pandillas/memberDossierView') : require(id), presentation, presentation.exports);
const Consultation = presentation.exports.MemberDossierConsultation;
const member: GangMember = { nombre: 'Nombre documental', alias: '', rol: '', edad: 0, curp: 'N/A', telefono: '  ', antecedentes: 'No refiere detenciones durante 2020', fotografiaUrl: 'legacy-unchanged' };
const photo = (id: string): DossierPhoto => ({ assetId: id, associationId: `association-${id}`, derivedSha256: id.repeat(64).slice(0, 64), derivedUrl: `https://storage.googleapis.com/synthetic/${id}.jpg`, documentVersion: 1, associationVersion: 1, width: 100, height: 120, mimeType: 'image/jpeg' });
const markup = (view: ReturnType<typeof buildMemberDossierView> | null) => renderToStaticMarkup(React.createElement(Consultation, { view, onWord: async () => {}, onClear: () => {} }));

test('one Word click calls the export handler once; render does not export', async () => {
  const isolated: any = { exports: {} };
  const adapter = { ...React, useState: (initial: unknown) => [initial, jest.fn()] };
  new Function('require', 'module', 'exports', compiled)((id: string) => id === 'react' ? adapter : id === '../memberDossierView' ? require('../src/modules/pandillas/memberDossierView') : require(id), isolated, isolated.exports);
  const onWord = jest.fn(async () => {});
  const tree = isolated.exports.MemberDossierConsultation({ view: buildMemberDossierView(member, 'Pandilla'), onWord, onClear: jest.fn() });
  const elements: any[] = [];
  const visit = (node: any) => { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(visit); elements.push(node); visit(node.props?.children); };
  visit(tree);
  expect(onWord).not.toHaveBeenCalled();
  const button = elements.find(node => node.type === 'button' && node.props.children === 'GENERAR WORD');
  await button.props.onClick();
  expect(onWord).toHaveBeenCalledTimes(1);
});

test('A/B/C: default consultation, explicit registration and cancel preserve selection without mutations', () => {
  expect(initialDossierConsultation).toEqual({ formOpen: false, selected: null });
  const selected = dossierConsultationTransition(initialDossierConsultation, member);
  const open = dossierConsultationTransition(selected, 'REGISTER'); expect(open.formOpen).toBe(true);
  expect(dossierConsultationTransition(open, 'CLOSE')).toEqual(selected);
  expect(dossierConsultationTransition(open, 'RESET')).toEqual(initialDossierConsultation);
  const ui = readFileSync('src/modules/pandillas/pandillas.ui.tsx', 'utf8');
  expect(source).toContain('+ REGISTRAR NUEVO INTEGRANTE'); expect(ui).toContain('<MemberDossierPanel formOpen={consultation.formOpen && legacyWriteEnabled} registerDisabled={!legacyWriteEnabled}');
  expect(ui).toContain('changeConsultation("CLOSE")'); expect(ui).toContain('void consultMasterMember(m)');
});
test('D/E/L/M: explicit selection renders read-only fields and Word, with no capture, edit or PDF action', () => {
  expect(markup(null)).toContain('Seleccione un integrante');
  const selected = dossierConsultationTransition(initialDossierConsultation, member);
  expect(selected.formOpen).toBe(false); expect(selected.selected).toBe(member);
  const html = markup(buildMemberDossierView(member, 'Pandilla'));
  expect(html).toContain(member.nombre); expect(html).toContain('GENERAR WORD');
  expect(html).not.toMatch(/<input|<textarea|<select|GUARDAR|EDITAR|APROBAR|RECHAZAR|PDF/);
});
test.each([null, undefined, '', '  ', [], ['N/A', ''], 'No registrado', 'No evaluado', 'Sin datos', 'N/A'])('F/G: omits absent value %p without empty sections', value => {
  expect(dossierValue(value)).toBeUndefined();
  const view = buildMemberDossierView({ nombre: 'Nombre', alias: value, rol: '', telefono: value, curp: value } as any, 'Pandilla');
  expect(view.sections).toEqual([]); expect(markup(view)).not.toContain('Datos de identificación');
});
test('meaningful negative text and zero values are preserved', () => {
  const view = buildMemberDossierView(member, 'Pandilla');
  expect(JSON.stringify(view.sections)).toContain(member.antecedentes); expect(JSON.stringify(view.sections)).toContain('"value":"0"');
});
test('H/I/J: primary first, additional visible, identical asset or SHA omitted', () => {
  const primary = photo('a'), extra = photo('b');
  const view = buildMemberDossierView(member, 'Pandilla', { primary, additional: [primary, { ...extra, derivedSha256: primary.derivedSha256 }, extra] });
  expect(view.photos.map(image => image.url)).toEqual([primary.derivedUrl, extra.derivedUrl]);
  const html = markup(view); expect(html).toContain('Fotografía principal'); expect(html).toContain('Otras fotografías asociadas');
  expect(html.match(/<img/g)).toHaveLength(2);
});
test('K: scope and exact unique member fingerprint isolate photographic response', () => {
  const primary = photo('a');
  const row = { memberFingerprint: 'F1', memberId: 'M1', assetId: primary.assetId, derivedUrl: primary.derivedUrl, hasPrimaryPhoto: true, primaryPhoto: primary, additionalPhotos: [photo('b')] };
  const response = { projectId: 'P', gangId: 'G', expiresAt: Date.now() + 120000, items: [row] };
  expect(bindDossierPhotos('P', 'G', ['F2'], response)).toEqual([{ additional: [] }]);
  expect(bindDossierPhotos('OTHER', 'G', ['F1'], response)).toEqual([]);
  expect(bindDossierPhotos('P', 'G', ['F1', 'F1'], response)).toEqual([{ additional: [] }, { additional: [] }]);
  expect(bindDossierPhotos('P', 'G', ['F1'], response)[0].additional).toHaveLength(1);
  expect(bindDossierPhotos('P', 'G', ['F1'], { ...response, expiresAt: 1 })).toEqual([]);
});
test('N/O: consultation view preserves complete source and legacy photo, performs no persistence', () => {
  const original = JSON.stringify(member); buildMemberDossierView(member, 'Pandilla', { primary: photo('a'), additional: [] });
  expect(JSON.stringify(member)).toBe(original);
  expect(source).not.toMatch(/saveGang|setIntegrantes|firebase|\.update\(|\.set\(|\.delete\(/);
});

test('registration panel renders no capture fields initially; real Register and Cancel handlers restore consultation', () => {
  const Panel = presentation.exports.MemberDossierPanel;
  let state = initialDossierConsultation;
  const register = () => { state = dossierConsultationTransition(state, 'REGISTER'); };
  const cancel = () => { state = dossierConsultationTransition(state, 'CLOSE'); };
  const form = React.createElement('form', {}, React.createElement('input', { name: 'existing-form-field' }), React.createElement('button', { onClick: cancel }, 'Cancelar'));
  const props = () => ({ formOpen: state.formOpen, onRegister: register, view: null, onWord: async () => {}, onClear: () => {}, children: form });
  const initial = renderToStaticMarkup(React.createElement(Panel, props()));
  expect(initial).toContain('+ REGISTRAR NUEVO INTEGRANTE'); expect(initial).not.toContain('<input');
  const tree = Panel(props()); tree.props.children[0].props.onClick();
  expect(renderToStaticMarkup(React.createElement(Panel, props()))).toContain('existing-form-field');
  (form.props as any).children[1].props.onClick();
  expect(renderToStaticMarkup(React.createElement(Panel, props()))).not.toContain('<input');
});
