jest.mock('@/lib/institutionalPandillasReadActions', () => ({ readInstitutionalMasterGangPhotos: jest.fn(), readInstitutionalMasterMember: jest.fn() }));
import { webcrypto } from 'crypto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { readFileSync } from 'fs';
import { resolvePandillasUiScope, canEditPandillasLegacy, selectPandillasMasterGang } from '@/modules/pandillas/pandillasUiScope';
import { readInstitutionalMasterGangPhotos } from '@/lib/institutionalPandillasReadActions';
import { loadMasterDossierPhotos } from '@/modules/pandillas/components/useMasterDossierPhotos';
import { legacyMemberFingerprint } from '@/modules/pandillas/photo-evidence/identity';
import { buildMemberDossierView, resolveDossierWordTarget, dossierConsultationTransition, initialDossierConsultation } from '@/modules/pandillas/memberDossierView';
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
const member = { nombre: 'Integrante sintético', alias: 'Alias documental', rol: '', edad: 30, antecedentes: 'Antecedente documental', tatuajes: 'Descripción documental' };
const gang = { id: 'gang-fixture', projectId: 'custody-fixture', nombre: 'Grupo sintético', integrantes: [member] };
const reader = readInstitutionalMasterGangPhotos as jest.Mock;
const photo = { assetId: 'asset-fixture', associationId: 'association-fixture', derivedSha256: 'a'.repeat(64),
  derivedUrl: 'https://storage.googleapis.com/synthetic/image.jpg', mimeType: 'image/jpeg', width: 100, height: 120,
  documentVersion: 1, associationVersion: 1, selectionVersion: 1 };
beforeEach(() => jest.clearAllMocks());
const compilePresentation = () => {
  const compiled = ts.transpileModule(readFileSync('src/modules/pandillas/components/MemberDossierConsultation.tsx', 'utf8'),
    { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', compiled)((id: string) => id === '../memberDossierView'
    ? require('../src/modules/pandillas/memberDossierView') : require(id), module, module.exports);
  return module.exports;
};
test('direct entry stays MASTER even with an unrelated remembered case', () => {
  const scope = resolvePandillasUiScope(false, 'remembered-case');
  expect(scope).toEqual({ mode: 'MASTER', caseEnabled: false, caseProjectId: undefined });
  expect(canEditPandillasLegacy(scope, true, gang)).toBe(false);
});
test('gang/member/dossier selection uses gang identity without case selection', () => {
  const selected = selectPandillasMasterGang([gang], gang.id);
  expect(selected).toBe(gang); expect(resolveDossierWordTarget([gang], gang.id)).toBe(gang);
  const consultation = dossierConsultationTransition(initialDossierConsultation, selected!.integrantes[0]);
  expect(consultation.selected).toBe(member);
  expect(selectPandillasMasterGang([gang, gang], gang.id)).toBeNull();
});
test('authorized primary and additional photo binding requires only gangId in UI', async () => {
  reader.mockResolvedValue({ projectId: gang.projectId, gangId: gang.id, expiresAt: Date.now() + 120000,
    items: [{ memberFingerprint: await legacyMemberFingerprint(member), memberId: 'identity-fixture',
      hasPrimaryPhoto: true, assetId: photo.assetId, derivedUrl: photo.derivedUrl, primaryPhoto: photo,
      additionalPhotos: [{ ...photo, assetId: 'additional-fixture', derivedSha256: 'b'.repeat(64) }] }] });
  const photos = await loadMasterDossierPhotos(gang.id, [member]);
  expect(reader).toHaveBeenCalledWith(gang.id); expect(photos[0].primary).toEqual(photo);
  expect(photos[0].additional).toHaveLength(1);
  const view = buildMemberDossierView(member, gang.nombre, photos[0]);
  const markup = renderToStaticMarkup(React.createElement(compilePresentation().MemberDossierPanel,
    { formOpen: false, registerDisabled: true, onRegister: jest.fn(), view, onWord: jest.fn(), onClear: jest.fn(), children: null }));
  expect(markup).toContain('GENERAR WORD'); expect(markup).toContain(member.nombre);
  expect(markup).toContain(photo.derivedUrl); expect(markup).toContain('disabled=""');
  expect(markup).not.toMatch(/disabled=""[^>]*>GENERAR WORD/);
});
test('missing custody, changed scope and denied authorization have no case fallback', async () => {
  reader.mockResolvedValue(null);
  await expect(loadMasterDossierPhotos(gang.id, [member])).rejects.toThrow('PRIMARY_UNAVAILABLE');
  reader.mockResolvedValue({ gangId: 'other' });
  await expect(loadMasterDossierPhotos(gang.id, [member])).rejects.toThrow();
  reader.mockRejectedValue(new Error('ACCESS_DENIED'));
  await expect(loadMasterDossierPhotos(gang.id, [member])).rejects.toThrow('ACCESS_DENIED');
});
test('CASE requires explicit context and legacy editing still requires matching custody', () => {
  expect(resolvePandillasUiScope(true).caseEnabled).toBe(false);
  expect(canEditPandillasLegacy(resolvePandillasUiScope(true, 'other-case'), true, gang)).toBe(false);
  expect(canEditPandillasLegacy(resolvePandillasUiScope(true, gang.projectId), false, gang)).toBe(false);
  expect(canEditPandillasLegacy(resolvePandillasUiScope(true, gang.projectId), true, gang)).toBe(true);
});
test('UI wires server reads and guards mutations/context without project fallback for photos', () => {
  const ui = readFileSync('src/modules/pandillas/pandillas.ui.tsx', 'utf8');
  expect(ui).toContain('useMasterDossierPhotos(selectedGangId, integrantes');
  expect(ui).toContain('await readInstitutionalMasterMember(selectedGangId, member.nombre)');
  expect(ui).toContain('if (!caseEnabled) return;');
  expect(ui).toContain('if (!legacyWriteEnabled) { alert(PANDILLAS_LEGACY_EDIT_MESSAGE); return; }');
  expect(ui).toContain('disabled={!caseEnabled || isAnalyzing}');
  expect(ui).not.toContain('useDossierPhotos(consultationTarget?.projectId');
  const adapter = readFileSync('src/modules/pandillas/components/useMasterDossierPhotos.ts', 'utf8');
  expect(adapter).not.toMatch(/currentProject|selectedProject|firstProject|firebase|\.set\(|\.update\(/);
});
