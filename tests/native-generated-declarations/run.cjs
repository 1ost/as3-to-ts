const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const api = require('../../lib');
const {nativeGeneratedDeclarationSource} = require('../../lib/emit/native-generated-declarations');
const ts = require('typescript');
const engine = path.resolve(process.env.LAYA_ENGINE_REPOSITORY || '../LayaAir-op2');
const esbuild = require(path.join(engine, 'node_modules/esbuild'));
const nativeEvidence = path.join(engine,'tests/nativeFlashOracle/generated-declaration-storage');
assert.equal(require(path.join(nativeEvidence,'verify.cjs')).length,15);
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const source = (text, referenceOnly) => ({source:text,sourceSha256:hash(text),...(referenceOnly ? {referenceOnly:true} : {})});
const oracleSources=Object.fromEntries(fs.readdirSync(path.join(nativeEvidence,'source/declcases')).map(file=>[
  'declcases.'+file.slice(0,-3),source(fs.readFileSync(path.join(nativeEvidence,'source/declcases',file),'utf8'),['ShadowEvent.as','StorageProbe.as'].includes(file))]));
const oraclePlan=api.createNativeGeneratedDeclarationPlan({scope:'native-evidence',providerModule:'./provider',sources:oracleSources});
assert.equal(oraclePlan.bindings.length,5);
assert.equal(oraclePlan.bindings.find(b=>b.qname==='declcases.TimingDerived').base,'declcases.TimingBase');
const fixture = () => ({scope:'test-domain', providerModule:'./provider', sources:{
  'records.AChild':source('package records { public class AChild extends ZBase { public var self:ZBase; } }'),
  'records.ZBase':source('package records { public class ZBase { public var child:AChild; public var bytes:flash.utils.ByteArray; } }'),
  'events.Ref':source('package events { import records.*; public class Ref extends MissingEvent { public var value:AChild; public var foreign:Missing; public var anything:*; } }',true),
},providers:{'flash.utils.ByteArray':{module:'./provider',exportName:'ByteArray'}}});
const input = fixture(), plan = api.createNativeGeneratedDeclarationPlan(input);
assert.equal(plan.bindings.length,2);
assert.equal(plan.nativeBindings.length,1);
assert.equal(plan.bindings[0].base,'records.ZBase');
assert(plan.moduleSource.indexOf('const __authority_type1') < plan.moduleSource.indexOf('const __authority_type0'));
assert(!plan.moduleSource.includes('MissingEvent'));
assert.equal(plan.references.find(r=>r.owner==='events.Ref'&&r.sourceName==='AChild').identity,'records.AChild');
assert.equal(plan.references.find(r=>r.sourceName==='Missing').kind,'unresolved');
assert.equal(plan.references.find(r=>r.sourceName==='*').kind,'intrinsic');
assert.equal(plan.references.find(r=>r.sourceName==='flash.utils.ByteArray').kind,'native');
for(const name of Object.keys(input.sources)) assert.equal(nativeGeneratedDeclarationSource(plan,input.scope,name,input.sources[name].source).sourceSha256,input.sources[name].sourceSha256);
assert(Object.isFrozen(plan)&&Object.isFrozen(plan.bindings)&&Object.isFrozen(plan.sourceHashes));
input.sources['records.ZBase'].source='changed';
assert.equal(plan.sourceHashes['records.ZBase'],fixture().sources['records.ZBase'].sourceSha256);
const reordered=fixture(); reordered.sources=Object.fromEntries(Object.entries(reordered.sources).reverse());
assert.deepEqual(api.createNativeGeneratedDeclarationPlan(reordered),plan);

let guards=0;
function rejects(change) {const input=fixture();change(input);assert.throws(()=>api.createNativeGeneratedDeclarationPlan(input),/AS3_GENERATED_DECLARATIONS_UNSUPPORTED/);guards++;}
rejects(x=>x.sources['records.AChild'].source+=' ');
rejects(x=>x.sources['wrong.Name']=x.sources['records.AChild']);
rejects(x=>x.sources['records.AChild'].referenceOnly='yes');
rejects(x=>x.sources['records.ZBase']=source('package records { public class ZBase extends AChild {} }'));
rejects(x=>x.sources['records.AChild']=source('package records { public class AChild extends External {} }'));
rejects(x=>x.sources['records.AChild']=source('package records { public class AChild implements IThing {} }'));
rejects(x=>x.sources['records.ZBase'].referenceOnly=true);
rejects(x=>x.sources['records.AChild']=source('package records { public class AChild {} } class Hidden {}'));
rejects(x=>x.providers['records.ZBase']={module:'./provider',exportName:'ByteArray'});
rejects(x=>x.providers.Object={module:'./provider',exportName:'Object'});
rejects(x=>x.providers['flash.utils.ByteArray'].module='bad\nmodule');
rejects(x=>x.providers['flash.utils.ByteArray'].exportName='x.y');
rejects(x=>x.providers['flash.utils.ByteArray'].admitted=true);
rejects(x=>x.sources['records.AChild'].trusted=true);
rejects(x=>Object.defineProperty(x.sources['records.AChild'],'source',{get(){throw Error('getter invoked');},enumerable:true}));
rejects(x=>x.extra=x);
rejects(x=>{x.extra=[];x.extra.push(x.extra);});
rejects(x=>{x.sources['a.Node']=source('package a { public class Node {} }');x.sources['b.Node']=source('package b { public class Node {} }');x.sources['records.AChild']=source('package records { import a.*; import b.*; public class AChild { public var value:Node; } }');});
rejects(x=>x.sources['records.AChild']=source('package records { import a.Node; import b.Node; public class AChild { public var value:Node; } }'));
rejects(x=>{x.sources['records.String']=source('package records { public class String {} }');x.sources['records.AChild']=source('package records { public class AChild { public var value:String; } }');});
for(const candidate of [JSON.parse(JSON.stringify(plan)),{...plan},null]) {
  assert.throws(()=>nativeGeneratedDeclarationSource(candidate,plan.scope,'records.AChild',fixture().sources['records.AChild'].source),/exact planned/);guards++;
}
for(const [scope,name,text] of [['other','records.AChild',fixture().sources['records.AChild'].source],[plan.scope,'unknown',''],[plan.scope,'records.AChild','changed']]) {
  assert.throws(()=>nativeGeneratedDeclarationSource(plan,scope,name,text),/exact planned/);guards++;
}

// Use the real common provider, not a fake declaration implementation.
const modules=['AS3DeclarationType','FlashTypeMetadata','AS3Type','ByteArray'];
const bundle=esbuild.buildSync({absWorkingDir:engine,stdin:{contents:modules.map(name=>'export * from "./src/layaAir/flash/utils/'+name+'";').join('\n'),resolveDir:engine,loader:'ts'},bundle:true,write:false,format:'cjs',platform:'node',target:'es2020',metafile:true});
const providerModule={exports:{}};new Function('module','exports',bundle.outputFiles[0].text)(providerModule,providerModule.exports);
const provider=providerModule.exports;
const cache=path.resolve('.cache/native-generated-declarations');fs.mkdirSync(cache,{recursive:true});
const run=fs.mkdtempSync(path.join(cache,'run-'));
fs.writeFileSync(path.join(run,'provider-graph.json'),JSON.stringify(Object.keys(bundle.metafile.inputs).filter(x=>x!=='<stdin>').map(file=>({file,sha256:hash(fs.readFileSync(path.resolve(engine,file)))})),null,2));
for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]) {
  const compiled=ts.transpileModule(plan.moduleSource,{compilerOptions:{target,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
  assert.deepEqual(compiled.diagnostics,[]);
  fs.writeFileSync(path.join(run,'plan-'+target+'.js'),compiled.outputText);
  const load=()=>{const output={};new Function('exports','require',compiled.outputText)(output,name=>{assert.equal(name,'./provider');return provider;});return output;};
  const first=load(),second=load();
  assert.notEqual(first.type0,second.type0);assert.equal(first.type0.name,'records::AChild');
  assert.equal(first.native0,provider.ByteArray);assert.equal(first.native0,second.native0);
  const nativeValue=new provider.ByteArray();assert.equal(provider.as3Is(nativeValue,first.native0),true);
  assert.equal(provider.as3Is(Object.create(provider.ByteArray.prototype),first.native0),false);
  let baseEntry,childEntry;
  class Base {constructor(){baseEntry.enterInstance(this);}}
  class Child extends Base {constructor(){super();childEntry.enterInstance(this);}}
  const members=()=>({variables:[],accessors:[],methods:[],constants:[]});
  provider.registerFlashTypeMetadata(Base,{name:'records::ZBase',base:'Object',isDynamic:false,isFinal:false,instance:members(),statics:members()});
  baseEntry=first.publish1(Base);
  provider.registerFlashTypeMetadata(Child,{name:'records::AChild',base:'records::ZBase',isDynamic:false,isFinal:false,instance:members(),statics:members()});
  childEntry=first.publish0(Child);
  const value=new Child();
  assert(provider.as3Is(value,first.type0)&&provider.as3Is(value,first.type1));
  assert.equal(provider.as3Is(value,second.type0),false);
  assert.equal(provider.as3Is(Object.create(Child.prototype),first.type0),false);
  assert.equal(provider.as3CoerceReference(undefined,first.type0),null);
  assert.throws(()=>provider.as3CoerceReference({},first.type0));
  assert.throws(()=>second.publish0(Child));
  assert.throws(()=>first.publish0(class Unregistered {}));
}
fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({guards,targets:['ES5','ES2015'],scope:'Declaration identity planning only; generated class initialization and native-provider metadata admission remain separate.'},null,2));
console.log('Declaration planning: '+guards+' guards; real-provider identity, inheritance and forgeries checked on ES5/ES2015. '+run);
