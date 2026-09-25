'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('typescript-4-9');
const root=path.resolve(__dirname,'../..'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?`[${v.map(canonical).join(',')}]`:`{${Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')}}`;
const source=fs.readFileSync(path.join(root,'src/hardened/reflection-provider-authority.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
assert.equal(compiled.diagnostics.length,0);
const loaded={exports:{}};
class HardenedSemanticError extends Error {constructor(code,message){super(message);this.code=code;}}
Function('require','module','exports','__dirname',compiled.outputText)(name=>name==='./contracts'?{HardenedSemanticError}:require(name),loaded,loaded.exports,path.join(root,'lib'));
const {loadReflectionProviderTarget,assertReflectionProviderTarget}=loaded.exports;
test('optional reflection proof rejects forged branded result and noncanonical or widened documents',()=>{
 assert.throws(()=>assertReflectionProviderTarget({metadataModule:'fake'},'{}'),/verified target/);
 const target='{"capabilities":[]}';
 const proof={schema:'as3-reflection-provider-target@1',targetCapabilitiesSha256:sha(target),targetCapabilityId:'api.flash.utils',targets:[],targetSources:{}};
 for(const value of [canonical(proof),canonical({...proof,sourceQName:'flash.utils.describeType'})+'\n',canonical({...proof,targetCapabilitiesSha256:'0'.repeat(64)})+'\n'])
  assert.throws(()=>loadReflectionProviderTarget(value,'/unread/ledger.json',target),/schema or target pin/);
});

test('function export resolver binds exact declaration signature and rejects promises in a ledger',t=>{
 const os=require('node:os'),cp=require('node:child_process');
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'reflection-resolver-')));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const module='src/layaAir/flash/utils/Provider.ts';fs.mkdirSync(path.dirname(path.join(dir,module)),{recursive:true});
 const run=(text,signature,kind='function')=>{
  fs.writeFileSync(path.join(dir,module),text);const hash=sha(text);
  return cp.spawnSync(process.execPath,[path.join(root,'tools/resolve-laya-export.cjs')],{input:JSON.stringify({root:dir,facade:{module,export:'provide',sha256:hash},candidates:[{module,export:'provide',kind,signature,sha256:hash}]}),encoding:'utf8',timeout:15000});
 };
 let result=run('export function provide(value: string): string { return value; }','(value: string) => string');
 assert.equal(result.status,0,result.stderr);assert.equal(Object.keys(JSON.parse(result.stdout).inputs).length,1);
 for(const [text,signature,kind] of [
  ['export function provide(value: number): number { return value; }','(value: string) => string','function'],
  ['export const provide=(value:string):string=>value;','(value: string) => string','function'],
  ['export function provide(value:string):string; export function provide(value:any):any {return value;}','(value: string) => string','function'],
  ['export function provide(value: string): string { return value; }','(value: string) => string','invented'],
 ]){result=run(text,signature,kind);assert.notEqual(result.status,0,text);}
});

test('published shared provider verifies both real export closures and branded identity',{skip:!process.env.HARDENED_FIXTURE_LAYA},()=>{
 const cp=require('node:child_process'),laya=fs.realpathSync(process.env.HARDENED_FIXTURE_LAYA);
 const targetPath=path.join(laya,'docTool/architecture/authored-content-capabilities.json');
 const targetJson=fs.readFileSync(targetPath,'utf8'),target=JSON.parse(targetJson);
 const capability=target.capabilities.find(row=>row.id==='api.flash.utils');
 const names=['createFlashReflectionMetadata','describeTypeXml'];
 const rows=names.map(name=>capability.obligations.find(row=>row.export===name));assert.ok(rows.every(Boolean));
 const targetSources={};
 for(const row of rows){
  const result=cp.spawnSync(process.execPath,[path.join(root,'tools/resolve-laya-export.cjs')],{input:JSON.stringify({root:laya,facade:{module:row.module,export:row.export,sha256:row.sha256},candidates:[row]}),encoding:'utf8',timeout:30000});
  assert.equal(result.status,0,result.stderr);
  for(const [file,hash] of Object.entries(JSON.parse(result.stdout).inputs))targetSources[path.relative(laya,file).split(path.sep).join('/')]=hash;
 }
 const proof={schema:'as3-reflection-provider-target@1',targetCapabilitiesSha256:sha(targetJson),targetCapabilityId:'api.flash.utils',targets:rows.map(({module,export:exported,signature,sha256})=>({module,export:exported,signature,sha256})),targetSources};
 const verified=loadReflectionProviderTarget(canonical(proof)+'\n',targetPath,targetJson);
 assertReflectionProviderTarget(verified,targetJson);
 assert.throws(()=>assertReflectionProviderTarget({...verified},targetJson),/verified target/);
 assert.throws(()=>assertReflectionProviderTarget(verified,targetJson+' '),/verified target/);
 const missing={...proof,targetSources:{...targetSources}};delete missing.targetSources['src/layaAir/flash/events/UnsupportedFlashFeatureError.ts'];
 assert.throws(()=>loadReflectionProviderTarget(canonical(missing)+'\n',targetPath,targetJson),/incomplete/);
 const drift={...proof,targetSources:{...targetSources,[rows[0].module]:'0'.repeat(64)}};
 assert.throws(()=>loadReflectionProviderTarget(canonical(drift)+'\n',targetPath,targetJson),/bytes do not match/);
 const extraPath='src/layaAir/flash/utils/getQualifiedClassName.ts';
 const extra={...proof,targetSources:{...targetSources,[extraPath]:sha(fs.readFileSync(path.join(laya,extraPath)))}};
 assert.throws(()=>loadReflectionProviderTarget(canonical(extra)+'\n',targetPath,targetJson),/transitive source closure differs/);
});
