import { readFileSync } from 'fs';
import ts from 'typescript';
import * as canonical from '../src/utils/canonicalProjectGeography';
function host(allowed=true,exists=true){
 const original:any={createdBy:'historical-analyst',createdAt:100,numeroExpediente:'20261001-0042-ABC',ceipolId:'CEIPOL/original',numeroExpedienteSequence:42,numeroExpedienteVersion:'1',name:'Original',documents:[{id:'d'}],streetViewEvidence:[{id:'s'}],findings:[{id:'f'}]};
 const records=new Map<string,any>();if(exists)records.set('projects/A',structuredClone(original));const writes=jest.fn(async(ref:any,data:any)=>{const prior=records.get(ref.path)||{};for(const key of ['createdBy','createdAt','numeroExpediente','ceipolId','numeroExpedienteSequence','numeroExpedienteVersion'])if(key in data&&JSON.stringify(prior[key])!==JSON.stringify(data[key]))throw new Error('RULES_PROTECTED_FIELD');records.set(ref.path,{...prior,...data});});
 const sdk={doc:(base:any,...parts:string[])=>({path:[...(base?.path?[base.path]:[]),...parts].join('/')}),collection:(_db:any,...parts:string[])=>({path:parts.join('/')}),getDoc:async(ref:any)=>({exists:()=>records.has(ref.path),data:()=>records.get(ref.path)}),setDoc:writes};
 const generic=new Proxy({__esModule:true} as any,{get:(_target,key)=>key==='__esModule'?true:(()=>({}))});
 const react={createContext:()=>({Provider:'Provider'}),useState:(initial:any)=>[typeof initial==='function'?initial():initial,()=>{}],useRef:(value:any)=>({current:value}),useCallback:(fn:any)=>fn,useMemo:(fn:any)=>fn(),useContext:()=>({})};
 const code=ts.transpileModule(readFileSync('src/context/ProjectContext.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;
 const exported:any={};new Function('require','exports','module',code)((name:string)=>{
 if(name==='react')return react;if(name==='react/jsx-runtime')return{jsx:(_type:any,props:any)=>({props}),jsxs:(_type:any,props:any)=>({props})};
 if(name==='firebase/firestore')return sdk;if(name==='@/lib/firebase')return{getDb:()=>({})};if(name==='@/context/AuthContext')return{useAuth:()=>({user:{username:'authorized-colleague',role:'USER'}})};
 if(name==='@/lib/institutionalCollectionActions')return{canWriteInstitutionalProject:async()=>allowed};if(name==='@/utils/canonicalProjectGeography')return canonical;return generic;
 },exported,{exports:exported});
 const context=exported.ProjectProvider({children:null}).props.value;
 return{original,records,writes,importProjectData:context.importProjectData};
}
const payload=(patch:any={})=>({text:async()=>JSON.stringify({version:'2.0-cloud',project:{id:'A',name:'Imported',geometryType:'individual',...patch},photos:[{id:'p',projectId:'A',tipo:'Field',comentario:'Imported photo'}]})});
test('assigned colleague import preserves original attribution/folio and unrelated existing evidence',async()=>{const f=host();await f.importProjectData(payload(),'authorized-colleague');expect(f.records.get('projects/A')).toMatchObject({...f.original,name:'Imported'});expect(f.records.get('projects/A/photos/p').comentario).toBe('Imported photo');});
test('forged protected identity fields in import never replace server stored values',async()=>{const f=host();await f.importProjectData(payload({createdBy:'fake',createdAt:999,numeroExpediente:'forged',ceipolId:'forged',numeroExpedienteSequence:999}),'fake');expect(f.records.get('projects/A')).toMatchObject({...f.original,name:'Imported'});});
test('import without WRITE grant fails before any write',async()=>{const f=host(false);await expect(f.importProjectData(payload(),'colleague')).rejects.toThrow();expect(f.writes).not.toHaveBeenCalled();});
test('import cannot create a missing project or bypass reservation',async()=>{const f=host(true,false);await expect(f.importProjectData(payload(),'colleague')).rejects.toThrow();expect(f.writes).not.toHaveBeenCalled();});
