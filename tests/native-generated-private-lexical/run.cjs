const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2'),evidence=path.join(engine,'tests/nativeFlashOracle/file-local-classes');
assert.equal(require(path.join(evidence,'verify.cjs')).length,24);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),sources={};
for(const file of fs.readdirSync(path.join(evidence,'source'),{recursive:true}).filter(f=>f.endsWith('.as'))){
 const source=fs.readFileSync(path.join(evidence,'source',file),'utf8');
 sources[file.replaceAll('\\','.').replaceAll('/','.').slice(0,-3)]={source,sourceSha256:hash(source)};
}
const input={scope:'private-lexical',sources,providerModule:'./types',vectorProviderModule:'./vectors',scriptGlobalProviderModule:'./globals',scriptDomainProvider:{module:'./domain',exportName:'domain'},inheritScriptClasses:true};
const plan=api.createNativeGeneratedDeclarationPlan(input),[first,child,second]=plan.privateBindings;

const {NativeGeneratedLexical}=require('../../lib/emit/native-generated-lexical');
const {nativeGeneratedDeclarationResolver}=require('../../lib/emit/native-generated-declarations');
const make=(identity,source=sources[identity]?.source||sources[plan.privateBindings.find(b=>b.identity===identity).declaration.sourceOwner].source)=>new NativeGeneratedLexical(plan,identity,source,true);
const primary=nativeGeneratedDeclarationResolver(plan,'localcases.First',sources['localcases.First'].source),secondPrimary=make('localcases.Second'),a=make(first.identity),c=make(child.identity),b=make(second.identity);
assert.deepEqual([secondPrimary.ownClass.findChild(require('../../lib/syntax/nodeKind').default.NAME).text,a.ownClass.findChild(require('../../lib/syntax/nodeKind').default.NAME).text,c.ownClass.findChild(require('../../lib/syntax/nodeKind').default.NAME).text],['Second','Helper','Child']);
assert.equal(primary.resolve('Value'),'choices.inside.Value');assert.equal(a.resolveTypeName('Value'),'choices.outside.Value');
assert.equal(primary.resolve('Helper'),first.identity);assert.equal(a.resolveTypeName('Helper'),first.identity);assert.equal(b.resolveTypeName('Helper'),second.identity);assert.equal(c.resolveTypeName('Helper'),first.identity);
assert.deepEqual(secondPrimary.own,[]);assert.deepEqual(a.own,[]);assert.deepEqual(b.own,[]);assert.deepEqual(c.own,[]);
assert(c.publication('Child','Base','headers','intrinsic').includes('getAS3InheritedLexicalBase(Base)'));
assert(a.publication('Helper','Base','headers','intrinsic').includes('headers.'+first.lexicalExport+'.set('));
assert(b.publication('Helper','Base','headers','intrinsic').includes('headers.'+second.lexicalExport+'.set('));
assert(secondPrimary.typedLocals);assert(a.typedLocals);assert(c.typedLocals);
let guards=0;const reject=(fn,re)=>{assert.throws(fn,re);guards++;};
const firstPrimary=make('localcases.First');assert(firstPrimary.typedLocals);
const privateCurrent=firstPrimary.trait('current',false);assert.equal(firstPrimary.typeExpression(privateCurrent.type,privateCurrent.owner,'headers','Array'),'{name:"::Helper",reference:headers.'+first.tokenExport+'}');
reject(()=>new NativeGeneratedLexical({...plan},first.identity,sources['localcases.First'].source,true),/exact planned scope/);
reject(()=>make(first.identity,sources['localcases.Second'].source),/exact planned/);
reject(()=>nativeGeneratedDeclarationResolver(plan,'localcases.Helper',sources['localcases.First'].source),/exact planned/);
reject(()=>nativeGeneratedDeclarationResolver(plan,first.identity,sources['localcases.First'].source+' '),/exact planned/);
// Namespace membership and initialization still require the established provider.
const source='package rules {public class Unit { private var current:Parent; public function read(v:*):int { var item:Parent=v; return 0; } }} class Parent { private static var counter:int = 3; protected var n:Number; } class Child extends Parent {}';
const p2=api.createNativeGeneratedDeclarationPlan({...input,sources:{'rules.Unit':{source,sourceSha256:hash(source)}}});
const unit=new NativeGeneratedLexical(p2,'rules.Unit',source,true);const current=unit.trait('current',false);
assert.equal(unit.typeExpression(current.type,current.owner,'headers','Array'),'{name:"::Parent",reference:headers.'+p2.privateBindings[0].tokenExport+'}');
const parent=new NativeGeneratedLexical(p2,p2.privateBindings[0].identity,source,true),derived=new NativeGeneratedLexical(p2,p2.privateBindings[1].identity,source,true);
assert.equal(parent.earlyStaticValue(parent.trait('counter',true)),'3');
assert.deepEqual(derived.traits.map(t=>[t.name,t.owner]),[['n',p2.privateBindings[0].identity]]);
const unresolved='package rules {public class Unit {}} class Helper { internal var n:uint; }';
const p3=api.createNativeGeneratedDeclarationPlan({...input,sources:{'rules.Unit':{source:unresolved,sourceSha256:hash(unresolved)}}});
reject(()=>new NativeGeneratedLexical(p3,p3.privateBindings[0].identity,unresolved,true),/internal namespace storage authority/);
console.log(JSON.stringify({qualification:'Private declaration lexical projection and typed-local identity; full execution checked by native-generated-private-modules',privateClasses:3,flashRows:24,guards}));
