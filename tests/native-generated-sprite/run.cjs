const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const api=require('../../lib');
const {NativeGeneratedClassTraits:Projection}=require('../../lib/emit/native-generated-traits');
const {nativeSpriteTraits}=require('../../lib/emit/native-sprite-traits');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const evidence=JSON.parse(execFileSync(process.env.PYTHON||'python',[path.join(__dirname,'verify.py'),engine],{encoding:'utf8'}));
assert.deepEqual(nativeSpriteTraits,evidence.traits);
assert(Object.isFrozen(nativeSpriteTraits)&&nativeSpriteTraits.every(Object.isFrozen));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const source='package sample {import flash.display.Sprite; public class Base extends Sprite {public function Base(){super();}}}';
const child='package sample {public class Child extends Base {public var field:int; public function Child(){super();}}}';
const record=source=>({source,sourceSha256:hash(source)});
// These bindings test projection only; no invented providers are executed.
const providers={'flash.display.Sprite':{module:'./sprite-provider',exportName:'Sprite',nativeBase:'Sprite'}};
const references=[...new Set(evidence.traits.map(t=>t.type).filter(t=>t&&t.includes('::')))];
for(const name of references)if(name!=='flash.display::Sprite')providers[name.replace('::','.')]=
    {module:'./reference-providers',exportName:name.split('::')[1]};
const input={scope:'sprite-projection',providerModule:'./registrar',providers,
    sources:{'sample.Base':record(source),'sample.Child':record(child)}};
const plan=api.createNativeGeneratedDeclarationPlan(input);
assert(plan.moduleSource.includes('requireGeneratedFlashSpriteSurface as __requireSpriteSurface'));
assert(plan.moduleSource.includes('__requireSpriteSurface();'));
const base=new Projection(plan,input.scope,'sample.Base',source),leaf=new Projection(plan,input.scope,'sample.Child',child);
const project=projection=>projection.instanceTraits.map(trait=>{
    const plural=trait.kind==='accessor'?'accessors':trait.kind==='method'?'methods':trait.kind==='variable'?'variables':'constants';
    const metadata=projection.metadata.instance[plural].find(t=>t.name===trait.name);
    return {name:trait.name,kind:trait.kind,declaredBy:metadata.declaredBy,
        ...(trait.type?{type:typeof trait.type==='string'?trait.type:trait.type.name}:{}),
        ...(trait.kind==='accessor'?{access:metadata.access}:{}),
        ...(trait.kind==='method'?{parameterCount:metadata.parameterCount}:{})};
});
assert.deepEqual(project(base),evidence.traits);
for(const trait of base.instanceTraits.filter(t=>t.kind==='accessor'))
    assert.equal(trait.access,evidence.traits.find(t=>t.name===trait.name).access);
assert.match(base.emitDefinition('domain','Array'),/name:"blendShader",kind:"accessor",access:"writeonly"/);
assert.deepEqual(project(leaf).slice(0,85),evidence.traits);
assert.equal(leaf.instanceTraits.length,86);
assert.equal(base.metadata.base,'flash.display::Sprite');
assert.equal(base.metadata.isDynamic,false);
for(const trait of base.instanceTraits.filter(t=>typeof t.type==='object')) {
    const binding=plan.nativeBindings.find(b=>b.referenceExport===trait.type.referenceExport);
    assert.equal(binding.qname,trait.type.name.replace('::','.'));
}
let guards=0;
for(const name of references.filter(n=>n!=='flash.display::Sprite')) {
    const changed={...providers};delete changed[name.replace('::','.')];
    const p=api.createNativeGeneratedDeclarationPlan({...input,providers:changed});
    assert.throws(()=>new Projection(p,input.scope,'sample.Base',source),/native Sprite trait requires explicit reference provider/);guards++;
}
for(const changed of [{...providers['flash.display.Sprite'],exportName:'Other'},
    {...providers['flash.display.Sprite'],nativeBase:'MovieClip'}]) {
    assert.throws(()=>api.createNativeGeneratedDeclarationPlan({...input,providers:{...providers,'flash.display.Sprite':changed}}),/exact supported/);guards++;
}
for(const member of ['public var x:int;','override public function get x():Number{return 1;}',
    'override public function toString():String{return "changed";}','override public function stopDrag():void{}']) {
    const changed=source.replace('public function Base()',member+' public function Base()');
    const p=api.createNativeGeneratedDeclarationPlan({...input,sources:{'sample.Base':record(changed)}});
    assert.throws(()=>new Projection(p,input.scope,'sample.Base',changed),/native Sprite override requires separate/);guards++;
}
// Same cohort must not let Sprite's override hold affect a separate EventDispatcher family.
const unrelated='package sample {import flash.events.EventDispatcher; public class Other extends EventDispatcher {public function Other(){super();} override public function toString():String{return "other";}}}';
const mixed={...input,sources:{...input.sources,'sample.Other':record(unrelated)},providers:{...providers,
    'flash.events.EventDispatcher':{module:'./events',exportName:'EventDispatcher',nativeBase:'EventDispatcher'}}};
const mixedPlan=api.createNativeGeneratedDeclarationPlan(mixed);
new Projection(mixedPlan,input.scope,'sample.Other',unrelated);
const ancestry=path.join(engine,'tests/nativeFlashOracle/generated-sprite-ancestry');
const maintained={};
for(const file of JSON.parse(fs.readFileSync(path.join(ancestry,'source-provenance.json'))).files) {
    if(file.retained==='source/SpriteAncestryProbe.as')continue;
    const bytes=fs.readFileSync(path.join(ancestry,file.retained));assert.equal(hash(bytes),file.sha256);
    maintained[file.retained.slice(7,-3).replaceAll('/','.')]=record(bytes.toString('utf8'));
}
const actualPlan=api.createNativeGeneratedDeclarationPlan({...input,sources:maintained,interfaceProviderModule:'./interfaces'});
const actualBase=new Projection(actualPlan,input.scope,'cn.kyiax.base.impl.BaseModule',maintained['cn.kyiax.base.impl.BaseModule'].source);
assert.deepEqual(project(actualBase),evidence.traits);
const actualChild=new Projection(actualPlan,input.scope,'spritecases.Child',maintained['spritecases.Child'].source);
assert.deepEqual(project(actualChild).slice(0,85),evidence.traits);
const emit=require('../../lib/emit'),parse=require('../../lib/parse'),ts=require('typescript');
const provider=name=>path.join(engine,'src/layaAir/flash/utils',name).replaceAll('\\','/');
const options={customVisitors:[],importModules:{'flash.display.Sprite':'./sprite-provider','cn.kyiax.base.IBaseModule':'./IBaseModule'},
    nativeGeneratedDeclarations:{plan:actualPlan,module:'./domain'},nativeClassTraitsModule:provider('AS3GeneratedClass'),
    nativeClassHelperModules:{nativeClass:path.resolve('utils/nativeClass').replaceAll('\\','/'),callableClass:path.resolve('utils/callableClass').replaceAll('\\','/')},
    nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
    nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String')};
const maintainedSource=maintained['cn.kyiax.base.impl.BaseModule'].source;
const emitted=emit(parse('BaseModule.as',maintainedSource),maintainedSource,options);
for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015])assert.deepEqual(ts.transpileModule(emitted,{compilerOptions:{target,module:ts.ModuleKind.CommonJS},reportDiagnostics:true}).diagnostics,[]);
const root=path.resolve('.cache/native-generated-sprite');fs.mkdirSync(root,{recursive:true});const out=fs.mkdtempSync(path.join(root,'run-'));
fs.writeFileSync(path.join(out,'BaseModule.ts'),emitted);
fs.writeFileSync(path.join(out,'domain.ts'),actualPlan.moduleSource);
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({traits:85,inheritedChildTraits:85,referenceTypes:references.length,guards,maintainedBaseModule:true,
    runtimeExecuted:false,scope:'Complete source trait projection only; provider surface and behavior remain separate.',inputs:evidence.inputs},null,2)+'\n');
console.log(JSON.stringify({traits:85,inheritedChildTraits:85,referenceTypes:references.length,guards,out,runtimeExecuted:false}));
