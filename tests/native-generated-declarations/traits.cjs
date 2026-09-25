const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),ts=require('typescript');
const {NativeGeneratedClassTraits:Projection}=require('../../lib/emit/native-generated-traits');
const {nativeGeneratedDeclarationInputs}=require('../../lib/emit/native-generated-declarations');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const evidence=path.join(engine,'tests/nativeFlashOracle/generated-declaration-storage');
const expected=require(path.join(evidence,'verify.cjs'));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const record=(source,referenceOnly=false)=>({source,sourceSha256:hash(source),referenceOnly});
const sources=Object.fromEntries(fs.readdirSync(path.join(evidence,'source/declcases')).map(file=>['declcases.'+file.slice(0,-3),
  record(fs.readFileSync(path.join(evidence,'source/declcases',file),'utf8'),['ShadowEvent.as','StorageProbe.as'].includes(file))]));
const input={scope:'oracle-storage',providerModule:'./provider',sources};
const plan=api.createNativeGeneratedDeclarationPlan(input);
const project=name=>new Projection(plan,input.scope,name,sources[name].source);
const projections=Object.fromEntries(plan.bindings.map(binding=>[binding.qname,project(binding.qname)]));
const storage=projections['declcases.Storage'];
assert.equal(storage.instanceTraits.length,11);
assert.deepEqual(storage.metadata.instance.accessors,[{name:'accessor',declaredBy:'declcases::Storage',access:'readwrite'}]);
assert.equal(storage.lexicalMembers.length,1);assert.equal(storage.lexicalMembers[0].visibility,'private');
assert.equal(storage.staticTraits.length,3);
assert.equal(projections['declcases.TimingDerived'].metadata.instance.variables.find(t=>t.name==='observations').declaredBy,'declcases::TimingBase');
assert.equal(projections['declcases.TimingDerived'].lexicalMembers.length,2);
assert.deepEqual(projections['declcases.DerivedRecord'].instanceTraits,projections['declcases.BaseRecord'].instanceTraits);
assert(!('sourceReflection' in storage.metadata));
assert(Object.isFrozen(storage)&&Object.isFrozen(storage.metadata.instance.accessors[0])&&Object.isFrozen(storage.instanceTraits[8].type));
assert(Object.isFrozen(nativeGeneratedDeclarationInputs(plan,input.scope).sources));

const sourcePlan=(base,child,extra={})=>{
  const sources={'spec.Base':record('package spec { '+base+' }'),...extra};
  if(child)sources['spec.Child']=record('package spec { '+child+' }');
  const plan=api.createNativeGeneratedDeclarationPlan({scope:'spec',providerModule:'./provider',sources});
  const owner=child?'spec.Child':'spec.Base';
  return new Projection(plan,'spec',owner,sources[owner].source);
};
const inherited=sourcePlan('public class Base { public var value:int; public function run(a:int):void {} public static var counter:int; }',
  'public class Child extends Base { override public function run(a:int):void {} public static var counter:String; }');
assert.deepEqual(inherited.metadata.instance.methods,[{name:'run',declaredBy:'spec::Child',parameterCount:1}]);
assert.deepEqual(inherited.metadata.instance.variables,[{name:'value',declaredBy:'spec::Base',type:'int'}]);
assert.deepEqual(inherited.staticTraits,[{name:'counter',kind:'variable',type:'String'}]);
const access=sourcePlan('public class Base { public function set only(value:String):void {} public function get read():int { return 0; } public static const C:int=1; }');
assert.deepEqual(access.metadata.instance.accessors.map(t=>t.access),['writeonly','readonly']);
assert.deepEqual(access.instanceTraits.map(t=>t.access),['writeonly','readonly']);
assert.equal(storage.instanceTraits.find(t=>t.name==='accessor').access,'readwrite');
assert.match(access.emitDefinition('domain','Array'),/name:"only",kind:"accessor",access:"writeonly"/);
assert.match(access.emitDefinition('domain','Array'),/name:"read",kind:"accessor",access:"readonly"/);
assert.deepEqual(access.metadata.statics.constants,[{name:'C',declaredBy:'spec::Base',type:'int'}]);
const forward=sourcePlan('public class Base { public var item:Child; }','public class Child extends Base {}');
assert.equal(forward.instanceTraits[0].type.name,'spec::Child');
let guards=0;
const reject=(fn,label)=>{assert.throws(fn,/AS3_(?:GENERATED_(?:TRAITS|DECLARATIONS)|NAMESPACE)_UNSUPPORTED/,label);guards++;};
for(const changed of [JSON.parse(JSON.stringify(plan)),{...plan},null])reject(()=>new Projection(changed,input.scope,'declcases.Storage',sources['declcases.Storage'].source));
reject(()=>new Projection(plan,'other','declcases.Storage',sources['declcases.Storage'].source));
reject(()=>new Projection(plan,input.scope,'declcases.Storage','changed'));
reject(()=>project('declcases.StorageProbe'));
reject(()=>storage.emitDefinition('domain;sideEffect()','Array'));
reject(()=>storage.emitDefinition('domain','getArray()'));
for(const body of [
  'public var bad:Missing;', 'public var bad:Class;', 'public var bad:XML;', 'public var bad:Vector.<int>;',
  'public const bad:int=1+1;', 'public var x:int; public var x:String;',
  'public function get x(a:int):int { return a; }',
  'public function set x():void {}', 'public function set x(a:int=0):void {}',
  'public function set x(a:int):int { return a; }',
  'public function get x():int { return 0; } public function set x(a:String):void {}',
  'public function get x():int { return 0; } public function get x():int { return 1; }',
  'public var x:int; public function x():void {}',
  'public namespace custom="example";', 'custom var x:int;',
  'override public function x():void {}', 'override public static function x():void {}'
])reject(()=>sourcePlan('public class Base { '+body+' }'),body);
for(const [base,child] of [
  ['public var x:int;','public var x:int;'],
  ['public function run():void {}','public function run():void {}'],
  ['final public function run():void {}','override public function run():void {}'],
  ['public function run():void {}','override public function run(a:int):void {}'],
  ['public function get x():int { return 0; } public function set x(a:int):void {}','override public function get x():int { return 0; }']
])reject(()=>sourcePlan('public class Base { '+base+' }','public class Child extends Base { '+child+' }'));
reject(()=>sourcePlan('public final class Base {}','public class Child extends Base {}'));

const esbuild=require(path.join(engine,'node_modules/esbuild'));
const modules=['AS3GeneratedClass','AS3Type','ByteArray'];
const bundle=esbuild.buildSync({absWorkingDir:engine,stdin:{contents:modules.map(name=>'export * from "./src/layaAir/flash/utils/'+name+'";').join('\n'),resolveDir:engine,loader:'ts'},bundle:true,write:false,format:'cjs',platform:'node',target:'es2020',metafile:true});
const providerModule={exports:{}};new Function('module','exports',bundle.outputFiles[0].text)(providerModule,providerModule.exports);
const provider=providerModule.exports;
const cache=path.resolve('.cache/native-generated-traits');fs.mkdirSync(cache,{recursive:true});const run=fs.mkdtempSync(path.join(cache,'run-'));
const generated=plan.moduleSource+'\n'+plan.bindings.map((binding,i)=>'export const spec'+i+'='+projections[binding.qname].emitDefinition('domain','Array')+';').join('\n');
fs.writeFileSync(path.join(run,'definitions.ts'),generated);
// Token module and definition expression are generated. Subject constructor
// bodies below are bridge probes, explicitly NOT transpiled AS3 method bodies.
const rowsByTarget=[];
for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]) {
  const compiled=ts.transpileModule(generated,{compilerOptions:{target,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
  assert.deepEqual(compiled.diagnostics,[]);
  const domain={};new Function('exports','require','domain',compiled.outputText)(domain,name=>{assert.equal(name,'./provider');return provider;},domain);
  fs.writeFileSync(path.join(run,'definitions-'+target+'.js'),compiled.outputText);
  const definitions=Object.fromEntries(plan.bindings.map((b,i)=>[b.qname,domain['spec'+i]]));
  let baseEntry,derivedEntry,entry;
  class BaseRecord {constructor(){baseEntry.enterInstance(this);this.label='base';}}
  class DerivedRecord extends BaseRecord {constructor(){super();derivedEntry.enterInstance(this);this.label='derived';}}
  class Storage {constructor(){entry.enterInstance(this);this.saved=null;}get accessor(){return this.saved;}set accessor(value){this.calls++;this.saved=value;}}
  baseEntry=provider.registerAS3GeneratedClass(BaseRecord,definitions['declcases.BaseRecord']);
  derivedEntry=provider.registerAS3GeneratedClass(DerivedRecord,definitions['declcases.DerivedRecord']);
  entry=provider.registerAS3GeneratedClass(Storage,definitions['declcases.Storage']);
  const rows=[],row=(id,value)=>rows.push({id,value}),s=new Storage(),b=new BaseRecord(),d=new DerivedRecord();
  row('defaults',[s.signed,s.unsigned,String(s.numeric),s.flag,s.text,s.object,s.array,s.anything===undefined,s.reference,s.accessor,s.calls]);
  row('static-defaults',[Storage.staticReference,Storage.staticInt,String(Storage.staticNumber)]);
  s.reference=b;row('reference-base',s.reference===b);
  s.reference=d;row('reference-derived',[s.reference===d,provider.as3Is(s.reference,domain[plan.bindings.find(b=>b.qname==='declcases.BaseRecord').tokenExport])]);
  s.reference=undefined;row('reference-undefined',s.reference===null);
  const error=fn=>{try{fn();return [];}catch(e){return [e.name,e.errorID];}};
  s.reference=b;row('reference-rejection',[error(()=>s.reference={}),s.reference===b]);
  s.accessor=d;row('accessor-derived',[s.accessor===d,s.calls]);
  row('accessor-rejection',[error(()=>s.accessor={}),s.accessor===d,s.calls]);
  s.accessor=undefined;row('accessor-undefined',[s.accessor===null,s.calls]);
  Storage.staticReference=d;row('static-reference-derived',Storage.staticReference===d);
  row('static-reference-rejection',[error(()=>Storage.staticReference={}),Storage.staticReference===d]);
  Storage.staticReference=undefined;row('static-reference-undefined',Storage.staticReference===null);
  for(const row of rows)assert.deepEqual(row,expected.find(item=>item.id===row.id),row.id);
  rowsByTarget.push({target,rows});
}
// Importing ByteArray preserves its constructor but cannot fabricate the
// still-missing canonical Class declaration metadata required by the registrar.
const nativeSource='package nativecase { public class Holder { public var bytes:flash.utils.ByteArray; } }';
const nativePlan=api.createNativeGeneratedDeclarationPlan({scope:'native',providerModule:'./provider',sources:{'nativecase.Holder':record(nativeSource)},providers:{'flash.utils.ByteArray':{module:'./provider',exportName:'ByteArray'}}});
const nativeProjection=new Projection(nativePlan,'native','nativecase.Holder',nativeSource);
const nativeCompiled=ts.transpileModule(nativePlan.moduleSource,{compilerOptions:{module:ts.ModuleKind.CommonJS}});
const nativeDomain={};new Function('exports','require',nativeCompiled.outputText)(nativeDomain,()=>provider);
const nativeDefinition=new Function('domain','return '+nativeProjection.emitDefinition('domain','Array'))(nativeDomain);
assert.throws(()=>provider.registerAS3GeneratedClass(class Holder {},nativeDefinition),/native reference needs exact registered declaration identity/);guards++;
fs.writeFileSync(path.join(run,'projection.json'),JSON.stringify(projections,null,2));
fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({guards,sourceHashes:plan.sourceHashes,rowsByTarget,providerGraph:Object.keys(bundle.metafile.inputs).filter(x=>x!=='<stdin>').map(file=>({file,sha256:hash(fs.readFileSync(path.resolve(engine,file)))})),scope:'Generated declaration definitions with bridge subject bodies; emitter initialization, lexical lowering and complete reflection remain unqualified.'},null,2));
console.log('Generated traits: '+guards+' guards; 12 AIR storage comparisons on ES5/ES2015 definition output. '+run);
