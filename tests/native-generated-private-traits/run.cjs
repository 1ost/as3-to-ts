const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),{NativeGeneratedClassTraits}=require('../../lib/emit/native-generated-traits');
const {nativeGeneratedClassDeclaration}=require('../../lib/emit/native-generated-declarations');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2'),evidence=path.join(engine,'tests/nativeFlashOracle/file-local-classes');
assert.equal(require(path.join(evidence,'verify.cjs')).length,24);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),sources={};
for(const file of fs.readdirSync(path.join(evidence,'source'),{recursive:true}).filter(f=>f.endsWith('.as'))){
 const source=fs.readFileSync(path.join(evidence,'source',file),'utf8');
 sources[file.replaceAll('\\','.').replaceAll('/','.').slice(0,-3)]={source,sourceSha256:hash(source)};
}
const input={scope:'private-traits',sources,providerModule:'./types',vectorProviderModule:'./vectors',scriptGlobalProviderModule:'./globals',scriptDomainProvider:{module:'./domain',exportName:'domain'},inheritScriptClasses:true};
const plan=api.createNativeGeneratedDeclarationPlan(input),[first,child,second]=plan.privateBindings;
const projection=(p,b)=>new NativeGeneratedClassTraits(p,p.scope,b.identity,sources[b.declaration.sourceOwner].source);
const a=projection(plan,first),c=projection(plan,child),b=projection(plan,second);
assert.deepEqual([a.metadata.name,c.metadata.name,b.metadata.name],['::Helper','::Child','::Helper']);
assert.equal(c.metadata.base,'::Helper');assert.equal(c.inheritInstanceLayout,true);
assert.notEqual(a.binding.identity,b.binding.identity);assert.equal(a.binding.sourceOwner,'localcases.First');
assert.match(a.binding.scriptGlobalExport,/^publishPrivateScript/);assert(!('qname' in a.binding));
assert.deepEqual(a.instanceTraits.map(t=>[t.name,t.kind,t.type]),[['value','variable','int'],['inc','method',undefined],['peer','method',undefined]]);
assert.deepEqual(b.instanceTraits.map(t=>t.name),['value','inc']);
assert.deepEqual(a.instanceMethods.find(m=>m.name==='peer').returns,{name:'::Helper',referenceExport:first.tokenExport});
assert.deepEqual(c.instanceMethods,[{name:'inc',parameters:['int'],returns:'int',requiredCount:1,override:true,final:false}]);
assert.deepEqual(a.staticTraits.map(t=>t.name),['count','choice']);assert.deepEqual(b.staticTraits.map(t=>t.name),['count']);
assert.deepEqual(c.staticTraits,[]);assert.deepEqual(c.lexicalMembers,[]);
assert.deepEqual(c.metadata.instance.variables,[{name:'value',declaredBy:'::Helper',type:'int'}]);
const emitted=[a.emitDefinition('headers','Array'),c.emitDefinition('headers','Array','base'),b.emitDefinition('headers','Array')];
assert(emitted[0].includes('returns:{name:"::Helper",reference:headers.'+first.tokenExport+'}'));
assert(emitted[1].includes('instanceTraits:[{name:"inc",kind:"method"}]'));
for(let i=0;i<3;i++){assert(!emitted[i].includes('#file:'));assert(emitted[i].includes('type:headers.'+plan.privateBindings[i].tokenExport));}
const publicView=nativeGeneratedClassDeclaration(plan,'localcases.First');assert.equal(publicView.identity,'localcases.First');assert.equal(publicView.reflectedName,'localcases::First');
let guards=0;const reject=(fn,re)=>{assert.throws(fn,re);guards++;};
reject(()=>projection({...plan},first),/exact planned/);
reject(()=>new NativeGeneratedClassTraits(plan,plan.scope,first.identity,sources['localcases.Second'].source),/exact planned/);
reject(()=>nativeGeneratedClassDeclaration(plan,'localcases.Helper'),/exact planned/);
reject(()=>c.emitDefinition('headers','Array'),/compiler base expression/);
const guardSource=(body,re)=>{
 const source='package rules { public class Unit {} } '+body;
 const p=api.createNativeGeneratedDeclarationPlan({...input,sources:{'rules.Unit':{source,sourceSha256:hash(source)}}});
 reject(()=>new NativeGeneratedClassTraits(p,p.scope,p.privateBindings[1].identity,source),re);
};
guardSource('final class Parent {} class Child extends Parent {}',/extends final/);
guardSource('class Parent { public function f(x:int):int { return x; }} class Child extends Parent { public override function f(x:String):int { return 0; }}',/matching method signature/);
guardSource('class Parent { public function f(x:int):int { return x; }} class Child extends Parent { public function f(x:int):int { return x; }}',/inherited collision/);
guardSource('class Parent {} class Child extends Parent { public override function f():void {} }',/override without/);
// A helper constant's byte span belongs to its complete file, not a rewritten class.
const literalSource='package rules { public class Unit {} } class Parent { public const n:int = 17; }';
const literalPlan=api.createNativeGeneratedDeclarationPlan({...input,sources:{'rules.Unit':{source:literalSource,sourceSha256:hash(literalSource)}}});
const literal=new NativeGeneratedClassTraits(literalPlan,literalPlan.scope,literalPlan.privateBindings[0].identity,literalSource);
assert.deepEqual(literal.instanceConstants,[{name:'n',literal:'17'}]);
console.log(JSON.stringify({qualification:'Exact source private trait projection; full execution checked by native-generated-private-modules',privateClasses:3,flashRows:24,guards}));
