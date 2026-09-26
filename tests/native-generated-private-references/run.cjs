const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib');
const {nativeGeneratedClassDeclaration}=require('../../lib/emit/native-generated-declarations');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2'),evidence=path.join(engine,'tests/nativeFlashOracle/file-local-classes');
assert.equal(require(path.join(evidence,'verify.cjs')).length,24);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),sources={};
for(const file of fs.readdirSync(path.join(evidence,'source'),{recursive:true}).filter(f=>f.endsWith('.as'))){
 const source=fs.readFileSync(path.join(evidence,'source',file),'utf8');
 sources[file.replaceAll('\\','.').replaceAll('/','.').slice(0,-3)]={source,sourceSha256:hash(source)};
}
const provider=n=>path.join(engine,'src/layaAir/flash/utils',n).replaceAll('\\','/');
const input={scope:'private-callables',sources,providerModule:provider('AS3GeneratedClass'),vectorProviderModule:provider('AS3Vector'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./domain',exportName:'domain'},inheritScriptClasses:true};
const plan=api.createNativeGeneratedDeclarationPlan(input);
const {NativeGeneratedEmission}=require('../../lib/emit/native-generated-emission');
const helpers={nativeClass:path.resolve('utils/nativeClass').replaceAll('\\','/'),callableClass:path.resolve('utils/callableClass').replaceAll('\\','/')};
function emission(p,identity,source){const binding=nativeGeneratedClassDeclaration(p,identity);return new NativeGeneratedEmission(source||sources[binding.sourceOwner].source,{plan:p,module:'./headers',declarationIdentity:identity},provider('AS3GeneratedClass'),helpers,provider('AS3LexicalMembers'),provider('AS3Property'),true);}

const {NativeReferenceCoercion}=require('../../lib/emit/native-reference-coercion');
const {NativeClassInitializers}=require('../../lib/emit/native-class-initializers');
const {nativeGeneratedDeclarationNode}=require('../../lib/emit/native-generated-declarations');
const K=require('../../lib/syntax/nodeKind').default;
function references(p,identity,source,generated=true){return new NativeReferenceCoercion(source,{plan:p,module:'./headers',coercionModule:provider('AS3Type')},generated,false,false,false,[],false,false,false,false,false,false,false,false,false,identity);}
function initializers(g,source,node=nativeGeneratedDeclarationNode(g.options.plan,g.projection.binding.identity),classes=g.classes){return new NativeClassInitializers(node,source,{classes},undefined,g);}
const identities=['localcases.First','localcases.Second',...plan.privateBindings.map(b=>b.identity)];
for(const identity of identities){
 const binding=nativeGeneratedClassDeclaration(plan,identity),source=sources[binding.sourceOwner].source;
 const g=emission(plan,identity),r=references(plan,identity,source),node=nativeGeneratedDeclarationNode(plan,identity),init=initializers(g,source,node);
 const helper=plan.privateBindings.find(b=>b.declaration.sourceOwner===binding.sourceOwner&&b.declaration.name==='Helper');
 assert.equal(r.resolve('Helper'),helper.identity);assert.equal(r.type('Helper'),helper.tokenExport);assert.equal(r.sourceClass('Helper'),true);
 assert.equal(r.resolve('Value'),binding.sourceOwner==='localcases.Second'?'Value':identity.includes('#file:')?'choices.outside.Value':'choices.inside.Value');
 assert.equal(init.ownNames.size,1);assert.ok(init.ownNames.has(node));assert.equal(init.resolve(node,'Helper'),'lazy');
 assert.equal(init.resolve(node,'Value'),binding.sourceOwner==='localcases.Second'?null:'lazy');
 if(identity==='localcases.First')assert.equal(r.publicStaticMethod('Helper','choice'),true);
}
let guards=0;const reject=(fn,re)=>{assert.throws(fn,re);guards++;};
const identity=plan.privateBindings[0].identity,source=sources['localcases.First'].source,g=emission(plan,identity);
reject(()=>references({...plan},identity,source),/exact planned/);
reject(()=>references(plan,identity,source+' '),/exact planned/);
reject(()=>references(plan,identity,sources['localcases.Second'].source),/exact planned/);
reject(()=>references(plan,identity,source,false),/declaration selection requires generated/);
reject(()=>new NativeReferenceCoercion(source,{plan,module:'./headers',coercionModule:provider('AS3Type')},false),/additional consumer declarations/);
reject(()=>initializers(g,source,nativeGeneratedDeclarationNode(plan,'localcases.First')),/selected generated declaration/);
reject(()=>initializers(g,source,undefined,{...g.classes,[identity]:'ready'}),/initialization plan must agree/);
reject(()=>new NativeClassInitializers(nativeGeneratedDeclarationNode(plan,identity),source,{classes:g.classes}),/invalid class identity/);
// Inspect the original type and constant spans in each scope; a helper's
// parameter must never be attributed to its package class (or vice versa).
const scoped='package scoped { public class Unit { public function take(value:Helper):void {} } } class Helper { public static const label:String="outside"; public function Helper() {} public function take(value:Unit):void {} }';
const scopedPlan=api.createNativeGeneratedDeclarationPlan({...input,sources:{'scoped.Unit':{source:scoped,sourceSha256:hash(scoped)}}});
const helper=scopedPlan.privateBindings[0],ownRef=references(scopedPlan,'scoped.Unit',scoped),helperRef=references(scopedPlan,helper.identity,scoped);
assert.deepEqual(ownRef.literalStaticConstant('Helper','label'),{type:'String',literal:'"outside"'});
const ownNode=nativeGeneratedDeclarationNode(scopedPlan,'scoped.Unit'),helperNode=nativeGeneratedDeclarationNode(scopedPlan,helper.identity);
function parameter(node){return node.findChild(K.CONTENT).children.find(c=>c.kind===K.FUNCTION&&c.findChild(K.NAME).text==='take').findChild(K.PARAMETER_LIST).children[0].findChild(K.NAME_TYPE_INIT);}
assert.equal(ownRef.declaration(parameter(ownNode)).exported,helper.tokenExport);
assert.equal(ownRef.declaration(parameter(helperNode)),undefined);
assert.equal(helperRef.declaration(parameter(ownNode)),undefined);
console.log(JSON.stringify({qualification:'Authenticated per-declaration reference and initializer consumers; full helper module emission remains gated',selectedDeclarations:identities.length,guards}));
