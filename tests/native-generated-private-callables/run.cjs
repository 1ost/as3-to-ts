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
const {NativeCallableClasses}=require('../../lib/emit/native-callable-classes');
const helpers={nativeClass:path.resolve('utils/nativeClass').replaceAll('\\','/'),callableClass:path.resolve('utils/callableClass').replaceAll('\\','/')};
function emission(p,identity,source){const binding=nativeGeneratedClassDeclaration(p,identity);return new NativeGeneratedEmission(source||sources[binding.sourceOwner].source,{plan:p,module:'./headers',declarationIdentity:identity},provider('AS3GeneratedClass'),helpers,provider('AS3LexicalMembers'),provider('AS3Property'),true);}
function callable(g,source,options=g.sources){return new NativeCallableClasses(source,options,g.classes,provider('AS3MethodBinding'),provider('AS3Coercion'),undefined,undefined,provider('AS3String'),undefined,provider('AS3Addition'),g,provider('AS3Type'),provider('AS3Class'),path.join(engine,'src/layaAir/flash/errors/AS3SourceError').replaceAll('\\','/'));}
const identities=['localcases.First','localcases.Second',...plan.privateBindings.map(b=>b.identity)],views=[];
for(const identity of identities){
 const binding=nativeGeneratedClassDeclaration(plan,identity),source=sources[binding.sourceOwner].source,g=emission(plan,identity),c=callable(g,source);
 assert.equal(c.own.qname,identity);assert.equal(c.own.name,g.lexical.ownClass.findChild(require('../../lib/syntax/nodeKind').default.NAME).text);
 assert.equal(c.classes.size,8);assert.equal(c.sourceTexts.get(identity),source);
 assert.equal(c.sourceRoots.get(identity).start,g.lexical.ownClass.start);assert.equal(c.sourceRoots.get(identity).end,g.lexical.ownClass.end);
 assert.equal(g.sources[identity],source);assert.equal(g.classes[identity],'lazy');
 if(identity.includes('#file:')){assert.match(g.projection.binding.scriptGlobalExport,/^publishPrivateScript/);assert.deepEqual(c.own.parameters.map(p=>[p.name,p.type]),[['n','int']]);}
 views.push({identity,name:c.own.name,base:c.own.base,fields:c.own.fields});
}
assert.equal(views[3].base,plan.privateBindings[0].identity);
assert.deepEqual(views[2].fields,[{name:'value',value:'0'}]);assert.deepEqual(views[4].fields,[{name:'value',value:'0'}]);
let guards=0;const reject=(fn,re)=>{assert.throws(fn,re);guards++;};
reject(()=>emission({...plan},plan.privateBindings[0].identity),/exact planned/);
reject(()=>emission(plan,plan.privateBindings[0].identity,sources['localcases.Second'].source),/exact planned/);
const identity=plan.privateBindings[0].identity,g=emission(plan,identity),source=sources['localcases.First'].source;
reject(()=>callable(g,source,{...g.sources,[identity]:source+' '}),/exact planned/);
reject(()=>callable(g,sources['localcases.Second'].source),/current source bytes/);
reject(()=>api.emitNativeSourceClassModule({plan}),/target/);
// Constructor signatures keep private reference identity as well as numeric entry coercion.
const referenceSource='package args {public class Unit {}} class Helper { public function Helper(value:Helper=null) {} }';
const referencePlan=api.createNativeGeneratedDeclarationPlan({...input,sources:{'args.Unit':{source:referenceSource,sourceSha256:hash(referenceSource)}}});
const referenceIdentity=referencePlan.privateBindings[0].identity,referenceEmission=emission(referencePlan,referenceIdentity,referenceSource),referenceCallable=callable(referenceEmission,referenceSource);
assert.deepEqual(referenceCallable.own.parameters[0].reference,{identity:referenceIdentity,exported:referencePlan.privateBindings[0].tokenExport});
assert.equal(referenceCallable.own.parameters[0].optional,true);
console.log(JSON.stringify({qualification:'Complete source callable construction planning; full execution checked by native-generated-private-modules',selectedDeclarations:views.length,sourceClasses:8,guards,views}));
