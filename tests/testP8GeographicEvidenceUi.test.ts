import React from 'react';
import ts from 'typescript';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as geography from '../src/utils/geographicEvidencePresentation';
import { normalizeInstitutionalBaseEvidence } from '../src/utils/institutionalBaseEvidenceNormalizer';
import { createDraftProjectGeography, updateDraftProjectGeography, confirmDraftProjectGeography, buildDraftGeographyPreview } from '../src/utils/canonicalProjectGeography';

function load(relative: string, modules: Record<string, any>) {
  const file = resolve(process.cwd(), relative);
  const output = ts.transpileModule(readFileSync(file, 'utf8'), { fileName:file, compilerOptions: {
    module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.React, esModuleInterop:true, target:ts.ScriptTarget.ES2020,
  } }).outputText;
  const record = { exports:{} as any };
  new Function('require','module','exports',output)((name: string) => {
    if (name in modules) return modules[name];
    throw new Error(`Unexpected import ${name}`);
  },record,record.exports);
  return record.exports;
}
function nodes(tree: any, type?: any): any[] {
  if (!tree || typeof tree !== 'object') return [];
  return [...(!type || tree.type === type ? [tree] : []), ...React.Children.toArray(tree.props?.children).flatMap(child => nodes(child,type))];
}
function hooks() {
  let cursor = 0; const slots:any[] = [];
  const react = { ...React, useEffect:jest.fn(), useCallback:(fn:any)=>fn, useRef(initial:any) { const index=cursor++; return slots[index] ||= { current:initial }; },
    useMemo:(fn:any)=>fn(),
    useState(initial:any) { const index=cursor++; if (!(index in slots)) slots[index]=typeof initial === 'function' ? initial() : initial; return [slots[index],(next:any)=>{slots[index]=next;}]; } };
  return { react, reset:()=>{cursor=0;} };
}
function photoLayer() {
  const h=hooks(); const Marker=()=>null, InfoWindow=()=>null;
  const module=load('src/components/maps/layers/PhotoEvidenceLayer.tsx', { react:h.react, '@react-google-maps/api':{Marker,InfoWindow}, '@/utils/geographicEvidencePresentation':geography });
  const photo = { id:'additional', projectId:'A', sourceDocumentId:'original-document', geometryRole:'NONE', lat:21,lng:-102,previewUrl:'https://fixture.test/image' };
  const render=()=>{h.reset();return module.PhotoEvidenceLayer({visible:true,photographs:[photo]});};
  return { render,Marker,InfoWindow,photo };
}
test('actual pin keeps original resource, role label and unmodified position', () => {
  const h=photoLayer(); const marker=nodes(h.render(),h.Marker)[0];
  expect(marker.props.position).toEqual({lat:21,lng:-102}); expect(marker.props.label.text).toBe('EA');
  expect(marker.props.title).toContain('original-document');
});
test('click opens persistent info window; pointer interaction never closes it', () => {
  const h=photoLayer(); const marker=nodes(h.render(),h.Marker)[0];
  expect(marker.props.onMouseOver).toBeUndefined(); expect(marker.props.onMouseOut).toBeUndefined();
  marker.props.onClick();
  const first=nodes(h.render(),h.InfoWindow)[0];
  expect(first).toBeDefined(); expect(nodes(h.render(),h.InfoWindow)).toHaveLength(1);
  expect(nodes(first,'article')[0].props['data-resource-id']).toBe('original-document');
});
test('popup auto-pans within map, exposes a useful image and explicit close', () => {
  const h=photoLayer();nodes(h.render(),h.Marker)[0].props.onClick();
  const popup=nodes(h.render(),h.InfoWindow)[0];expect(popup.props.options).toMatchObject({disableAutoPan:false,maxWidth:340});
  expect(nodes(popup,'img')[0].props.className).toContain('h-44');
  nodes(popup,'button')[0].props.onClick();expect(nodes(h.render(),h.InfoWindow)).toHaveLength(0);
});
test('actual operational popup remains centered for arbitrary cursor updates and opens without anchor', () => {
  const h=hooks();const focus=jest.fn();const close=jest.fn(); const prior=(globalThis as any).document;
  (globalThis as any).document={body:{}};
  try {
    const module=load('src/components/DynamicPopup.tsx',{react:h.react,'react-dom':{createPortal:(tree:any)=>tree},'./useOperationalModalFocus':{useOperationalModalFocus:focus}});
    const render=(anchorPosition:any)=>{h.reset();return module.DynamicPopup({open:true,anchorPosition,onClose:close,children:'acción'});};
    const first=render({x:1,y:1}), moved=render({x:3000,y:4000}), noAnchor=render(null);
    expect(first.props.className).toContain('fixed inset-0');expect(first.props.className).toContain('items-center justify-center');
    expect(moved.props.className).toBe(first.props.className);expect(noAnchor).not.toBeNull();
    const panel=nodes(moved,'div').find(node=>node.props.role==='dialog');expect(panel.props['aria-modal']).toBe('true');expect(panel.props.style).toBeUndefined();
    nodes(moved,'button')[0].props.onClick();expect(close).toHaveBeenCalledTimes(1);expect(focus).toHaveBeenCalled();
  } finally { (globalThis as any).document=prior; }
});
test('modal keyboard effect traps focus, supports ESC and restores opener', () => {
  let setup!:()=>any; const prior=(globalThis as any).document;const opener={focus:jest.fn(),isConnected:true};
  const first={focus:jest.fn(),hidden:false},last={focus:jest.fn(),hidden:false};const close=jest.fn();const listeners:any={};
  const panel={focus:jest.fn(),querySelectorAll:()=>[first,last],addEventListener:(key:string,handler:any)=>{listeners[key]=handler;},removeEventListener:jest.fn()};
  (globalThis as any).document={activeElement:opener};
  try {
    const module=load('src/components/useOperationalModalFocus.ts',{react:{useRef:(value:any)=>({current:value}),useEffect:(effect:any)=>{setup=effect;}}});
    module.useOperationalModalFocus(true,{current:panel},close);const cleanup=setup();expect(panel.focus).toHaveBeenCalled();
    (globalThis as any).document.activeElement=last;
    const tab={key:'Tab',shiftKey:false,preventDefault:jest.fn()};listeners.keydown(tab);expect(first.focus).toHaveBeenCalled();expect(tab.preventDefault).toHaveBeenCalled();
    listeners.keydown({key:'Escape',preventDefault:jest.fn(),stopPropagation:jest.fn()});expect(close).toHaveBeenCalledTimes(1);
    cleanup();expect(opener.focus).toHaveBeenCalled();expect(panel.removeEventListener).toHaveBeenCalled();
  } finally {(globalThis as any).document=prior;}
});
test('barrido component uses portal modal and retains existing updateSweep decision handlers', () => {
  const h=hooks();const updateSweep=jest.fn();const setActiveSweepForModal=jest.fn();const prior=(globalThis as any).document;
  (globalThis as any).document={body:{}};
  try {
    const module=load('src/components/SweepIntegrationModal.tsx',{react:h.react,'react-dom':{createPortal:(tree:any)=>tree},
      '@/context/ProjectContext':{useProject:()=>({activeSweepForModal:{id:'sweep',engine:'GEOINT',source:'OSINT',type:'Directa',status:'Pendiente',relevance:'Medio',data:'Datos reales fixture'},updateSweep,setActiveSweepForModal})},
      '@/components/ui/CEIPOLButton':{CEIPOLButton:()=>null},'./useOperationalModalFocus':{useOperationalModalFocus:jest.fn()}});
    h.reset();const tree=module.SweepIntegrationModal();expect(tree.props.className).toContain('items-center justify-center');
    const panel=nodes(tree,'div').find(node=>node.props.role==='dialog');expect(panel.props.style).toBeUndefined();
    nodes(tree,'button').find(node=>node.props['aria-label']==='Cerrar barrido').props.onClick();expect(setActiveSweepForModal).toHaveBeenCalledWith(null);
    expect(updateSweep).not.toHaveBeenCalled();
  } finally {(globalThis as any).document=prior;}
});
test('geographic roles do not require mouse hover in ProjectMap; global modal controller cannot reposition map popups', () => {
  const source=readFileSync(resolve(process.cwd(),'src/components/ProjectMap.tsx'),'utf8');
  expect(source).not.toContain('onMouseOver=');expect(source).not.toContain('onMouseOut=');expect(source).toContain('disableAutoPan: false');
  const controller=readFileSync(resolve(process.cwd(),'src/components/CursorAnchoredDialogs.tsx'),'utf8');
  expect(controller).toContain('.gm-style, [data-operational-modal]');expect(controller).not.toContain('pointermove');expect(controller).not.toContain('ResizeObserver');
});

test.each([0, 1, 2, null])('actual upload callback and actual hydration preserve role %s across storage/reopening', async index => {
  const source = readFileSync(resolve(process.cwd(), 'src/context/ProjectContext.tsx'), 'utf8');
  const ast = ts.createSourceFile('ProjectContext.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let upload!: ts.ArrowFunction, hydrate!: ts.ArrowFunction;
  const functions: Record<string, ts.FunctionDeclaration> = {};
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'uploadAndAddPhoto' && node.initializer && ts.isCallExpression(node.initializer)) upload = node.initializer.arguments[0] as ts.ArrowFunction;
    if (ts.isArrowFunction(node) && node.parameters[0]?.name.getText(ast) === 'photoDoc') hydrate = node;
    if (ts.isFunctionDeclaration(node) && node.name) functions[node.name.text] = node;
    ts.forEachChild(node, visit);
  };
  visit(ast);
  const evaluate = (code: string, scope: any) => new Function('scope', 'with (scope) {' + ts.transpileModule(code.replace(/^export\s+/gm, ""), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText + '}')(scope);
  const stored: any[] = [], local: any[] = [];
  const project = { id:'A', geometryType:'lineal', canonicalGeography:{ geographyId:'geo-A', type:'CORRIDOR' } };
  const scope: any = { project, isReadOnly:false, imageCompression:async (file:any)=>file, COMPRESSION_OPTIONS:{},
    getStorage:()=>({}),generateId:()=> 'source-id',ref:(_storage:any,path:string)=>({fullPath:path}),
    uploadBytes:async (reference:any)=>({ref:reference}),getDownloadURL:async()=> 'https://fixture.test/photo',deleteObject:jest.fn(),
    getDb:()=>({}),collection:()=> 'photos',addDoc:async(_ref:any,data:any)=>{stored.push(JSON.parse(JSON.stringify(data)));return {id:'persisted-id'};},
    doc:()=>({}),updateDoc:jest.fn(),increment:(value:number)=>value,normalizeInstitutionalBaseEvidence,
    geographicEvidenceRole:geography.geographicEvidenceRole,geographicRoleLabels:geography.geographicRoleLabels,
    addPhotoToAlbum:(photo:any,id:string)=>local.push({...photo,id}),setSelectedIds:(fn:any)=>fn([]),process:{env:{}},
    projectId:'A',projectData:project,storedCanonicalGeography:project.canonicalGeography,
  };
  for (const name of ['sanitizeFirestorePayload', 'persistPhotoMetadataWithStorageRollback']) scope[name] = evaluate(functions[name].getText(ast) + `\nreturn ${name};`, scope);
  const save = evaluate(`const extracted = ${upload.getText(ast)}; return extracted;`, scope);
  const reopen = evaluate(`const extracted = ${hydrate.getText(ast)}; return extracted;`, scope);
  const draft = updateDraftProjectGeography(createDraftProjectGeography('lineal'), [{lat:21,lng:-102},{lat:22,lng:-103},{lat:23,lng:-104}]);
  const assignment = geography.bindPhotoToTerritorialNode(draft,index);
  await save({name:'photo.jpg'},21,-102,assignment);
  expect(stored).toHaveLength(1);expect(local[0]).toMatchObject(assignment);
  const reopened = reopen({id:'persisted-id',data:()=>stored[0]});
  expect(reopened).toMatchObject(assignment);expect(reopened.evidenceId).toBe(local[0].evidenceId);
  expect(reopened.isStreetView).toBe(false);
  if (index === null) expect(reopened).toMatchObject({geometryRole:'NONE',isGeometry:false,evidenceType:'ADDITIONAL_PHOTO'});
});

test.each(['GeointControlledSweepEngine', 'GeointTemporalComparativeEngine'])('actual %s uses centered portal with focus and explicit close without starting analysis', component => {
  const h=hooks(), close=jest.fn(), focus=jest.fn(), analyze=jest.fn();const prior=(globalThis as any).document;
  (globalThis as any).document={body:{}};
  try {
    const modules:any={ react:h.react,'react-dom':{createPortal:(tree:any)=>tree},'@/components/useOperationalModalFocus':{useOperationalModalFocus:focus},
      '@/lib/googleStreetView':{},'@/types/geointSweep':{GEOINT_SWEEP_CATEGORIES:[]},'@/utils/geoResolver':{},'@/types/geointGovernance':{},
      '@/utils/canonicalProjectGeography':{},'@/utils/evidenceLineage':{},'@/utils/googleIntelligenceContract':{},
      '../../types/geointEvidence':{},'../../types/geointTemporalComparison':{},'../../utils/geoResolver':{isSameLocation:()=>false,isValidCoordinate:()=>false},
      '../../services/geoint/temporalComparisonService':{compareTemporalEvidence:analyze},
    };
    const module=load(`src/modules/geoint/${component}.tsx`,modules);h.reset();
    const tree=module[component]({isOpen:true,lat:21,lng:-102,projectId:'A',onClose:close});
    expect(tree.props['data-operational-modal']).toBe('true');expect(tree.props.className).toContain('items-center justify-center');
    const panel=nodes(tree,'div').find(node=>node.props.role==='dialog');expect(panel).toBeDefined();expect(panel.props.style).toBeUndefined();
    expect(focus).toHaveBeenCalledWith(true,expect.anything(),close);expect(analyze).not.toHaveBeenCalled();
    const closeButton=nodes(tree,'button').find(node=>node.props.onClick===close);expect(closeButton).toBeDefined();closeButton.props.onClick();expect(close).toHaveBeenCalledTimes(1);
  } finally {(globalThis as any).document=prior;}
});

test.each([[[{}]], [[{geometryRole:'START'}]]])('actual creation gate rejects incomplete roles before creation and releases lock for retry: %j', async photos => {
  const source=readFileSync(resolve(process.cwd(),'src/components/ProjectList.tsx'),'utf8');
  const ast=ts.createSourceFile('ProjectList.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let handler!:ts.ArrowFunction;
  const visit=(node:ts.Node)=>{if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='handleConfirmarNombre')handler=node.initializer as ts.ArrowFunction;ts.forEachChild(node,visit);};visit(ast);
  const ref={current:false},creating=jest.fn(),create=jest.fn();
  const scope={nombreInput:'Expediente',user:{id:'1'},isCreatingProjectRef:ref,setIsCreatingProject:creating,pendingPhotosRef:{current:photos},pendingCabinetResult:null,
    draftGeography:confirmDraftProjectGeography(updateDraftProjectGeography(createDraftProjectGeography('lineal'),[{lat:21,lng:-102},{lat:22,lng:-103}])),
    geometryType:'lineal',buildDraftGeographyPreview,setDraftFeedback:jest.fn(),createProject:create};
  const output=ts.transpileModule(`const extracted=${handler.getText(ast)}; return extracted;`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
  const execute=new Function('scope','with(scope){'+output+'}')(scope);await execute();
  expect(create).not.toHaveBeenCalled();expect(ref.current).toBe(false);expect(creating).toHaveBeenLastCalledWith(false);expect(scope.setDraftFeedback).toHaveBeenCalled();
});


function roleHarness() {
  const h=hooks();
  const module=load('src/components/PhotoRolePresentation.tsx',{react:h.react,'@/utils/geographicEvidencePresentation':geography});
  return { render:(photo:any)=>{h.reset();return module.PhotoRolePresentation({photo,children:React.createElement('select',{onChange:jest.fn()})});} };
}
test.each(['Perímetro','Interior','Otro'])('persisted classification %s renders readonly without selector', tipo=>{
  const tree=roleHarness().render({id:'photo',tipo,geometryRole:'VERTEX',territorialRef:{role:'VERTEX',order:1}});
  expect(nodes(tree,'select')).toHaveLength(0);expect(nodes(tree,'p')[0].props.children).toEqual(['Rol: ',tipo]);
});
test('legacy unclassified retains explicit classification control without inventing geometry',()=>{
  const photo={id:'legacy',tipo:'',geometryRole:'LEGACY_UNCLASSIFIED'};const before=JSON.stringify(photo);
  expect(nodes(roleHarness().render(photo),'select')).toHaveLength(1);expect(JSON.stringify(photo)).toBe(before);
});
test('local draft remains editable until existing contextualization save confirms persistence',()=>{
  const h=roleHarness();h.render({id:'legacy',tipo:'',geometryRole:'LEGACY_UNCLASSIFIED'});
  expect(nodes(h.render({id:'legacy',tipo:'Interior',geometryRole:'LEGACY_UNCLASSIFIED'}),'select')).toHaveLength(1);
  expect(nodes(h.render({id:'legacy',tipo:'Interior',geometryRole:'LEGACY_UNCLASSIFIED',isContextualized:true}),'select')).toHaveLength(0);
});
test('reopening stored role never calls classification callback or modifies territorial association',()=>{
  const photo={id:'photo',tipo:'Interior',geometryRole:'VERTEX',territorialRef:{role:'VERTEX',order:4}};
  const before=JSON.stringify(photo);for(let i=0;i<2;i++) expect(nodes(roleHarness().render(photo),'select')).toHaveLength(0);
  expect(JSON.stringify(photo)).toBe(before);
});
test('real metadata callback preserves geometry and territorialRef when classification/comment changes',()=>{
  const source=readFileSync(resolve(process.cwd(),'src/context/ProjectContext.tsx'),'utf8');
  const begin=source.indexOf('  const updatePhotoMeta = useCallback(');const end=source.indexOf('  const updatePhotoRelationship',begin);
  const block=source.slice(begin,end);const photo={id:'p',tipo:'Interior',geometryRole:'VERTEX',territorialRef:{nodeId:'v4',order:4}};
  let album:any[]=[photo];const update=new Function('useCallback','isReadOnly','setAlbum',ts.transpileModule(block+'return updatePhotoMeta;', {compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText)((fn:any)=>fn,false,(fn:any)=>{album=fn(album);});
  update('p',{tipo:'Interior',comentario:'Contexto humano'});expect(album[0].geometryRole).toBe('VERTEX');expect(album[0].territorialRef).toBe(photo.territorialRef);
});
test('protected modal operation cannot close through ESC',()=>{
  let setup!:()=>any;const prior=(globalThis as any).document;const listeners:any={};const close=jest.fn();
  const panel={focus:jest.fn(),querySelectorAll:()=>[],addEventListener:(key:string,handler:any)=>listeners[key]=handler,removeEventListener:jest.fn()};
  (globalThis as any).document={activeElement:null};
  try {const module=load('src/components/useOperationalModalFocus.ts',{react:{useRef:(value:any)=>({current:value}),useEffect:(effect:any)=>{setup=effect;}}});
    module.useOperationalModalFocus(true,{current:panel},undefined);setup();listeners.keydown({key:'Escape',preventDefault:jest.fn(),stopPropagation:jest.fn()});expect(close).not.toHaveBeenCalled();
  } finally {(globalThis as any).document=prior;}
});

test('barrido while submitting disables X and withholds ESC callback',()=>{
  let cursor=0;const close=jest.fn(),focus=jest.fn();const prior=(globalThis as any).document;(globalThis as any).document={body:{}};
  try {const react={...React,useEffect:jest.fn(),useState:(initial:any)=>[cursor++===4 ? true : initial,jest.fn()],useRef:(initial:any)=>({current:initial}),useCallback:(fn:any)=>fn};
    const module=load('src/components/SweepIntegrationModal.tsx',{react,'react-dom':{createPortal:(tree:any)=>tree},
      '@/context/ProjectContext':{useProject:()=>({activeSweepForModal:{id:'s',engine:'GEOINT',source:'OSINT',type:'Directa',status:'Pendiente',relevance:'Medio',data:'fixture'},updateSweep:jest.fn(),setActiveSweepForModal:close})},
      '@/components/ui/CEIPOLButton':{CEIPOLButton:()=>null},'./useOperationalModalFocus':{useOperationalModalFocus:focus}});
    const tree=module.SweepIntegrationModal();const x=nodes(tree,'button').find(node=>node.props['aria-label']==='Cerrar barrido');expect(x.props.disabled).toBe(true);x.props.onClick();expect(close).not.toHaveBeenCalled();expect(focus.mock.calls[0][2]).toBeUndefined();
  } finally {(globalThis as any).document=prior;}
});
