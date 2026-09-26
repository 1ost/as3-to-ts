const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const api=require('../../lib');
const {NativeGeneratedClassTraits:Projection}=require('../../lib/emit/native-generated-traits');
const {nativeMovieClipTraits}=require('../../lib/emit/native-movieclip-traits');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const evidence=JSON.parse(execFileSync(process.env.PYTHON||'python',[path.join(__dirname,'verify.py'),engine],{encoding:'utf8'}));
assert.deepEqual(nativeMovieClipTraits,evidence.traits);
assert(Object.isFrozen(nativeMovieClipTraits)&&nativeMovieClipTraits.every(Object.isFrozen));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const source='package sample {import flash.display.MovieClip; public class Base extends MovieClip {public function Base(){super();}}}';
const child='package sample {public class Child extends Base {public var field:int; public function Child(){super();}}}';
const record=source=>({source,sourceSha256:hash(source)});
// These bindings test projection only; no invented providers are executed.
const providers={'flash.display.MovieClip':{module:'./movieclip-provider',exportName:'MovieClip',nativeBase:'MovieClip'}};
const references=[...new Set(evidence.traits.map(t=>t.type).filter(t=>t&&t.includes('::')))];
for(const name of references)if(name!=='flash.display::MovieClip')providers[name.replace('::','.')]=
    {module:'./reference-providers',exportName:name.split('::')[1]};
const input={scope:'movieclip-projection',providerModule:'./registrar',providers,
    sources:{'sample.Base':record(source),'sample.Child':record(child)}};
const plan=api.createNativeGeneratedDeclarationPlan(input);
assert(plan.moduleSource.includes('requireGeneratedFlashMovieClipSurface as __requireMovieClipSurface'));
assert(plan.moduleSource.includes('__requireMovieClipSurface();'));
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
assert.deepEqual(project(leaf).slice(0,105),evidence.traits);
assert.equal(leaf.instanceTraits.length,106);
assert.equal(base.metadata.base,'flash.display::MovieClip');
assert.equal(base.metadata.isDynamic,false);
for(const trait of base.instanceTraits.filter(t=>typeof t.type==='object')) {
    const binding=plan.nativeBindings.find(b=>b.referenceExport===trait.type.referenceExport);
    assert.equal(binding.qname,trait.type.name.replace('::','.'));
}
let guards=0;
for(const name of references.filter(n=>n!=='flash.display::MovieClip')) {
    const changed={...providers};delete changed[name.replace('::','.')];
    const p=api.createNativeGeneratedDeclarationPlan({...input,providers:changed});
    assert.throws(()=>new Projection(p,input.scope,'sample.Base',source),/native MovieClip trait requires explicit reference provider/);guards++;
}
for(const changed of [{...providers['flash.display.MovieClip'],exportName:'Other'},
    {...providers['flash.display.MovieClip'],nativeBase:'Sprite'}]) {
    assert.throws(()=>api.createNativeGeneratedDeclarationPlan({...input,providers:{...providers,'flash.display.MovieClip':changed}}),/exact supported/);guards++;
}
for(const member of ['public var x:int;','override public function get x():Number{return 1;}',
    'override public function toString():String{return "changed";}','override public function stop():void{}']) {
    const changed=source.replace('public function Base()',member+' public function Base()');
    const p=api.createNativeGeneratedDeclarationPlan({...input,sources:{'sample.Base':record(changed)}});
    assert.throws(()=>new Projection(p,input.scope,'sample.Base',changed),/native MovieClip override requires separate/);guards++;
}
// Same cohort must not let MovieClip's override hold affect a separate EventDispatcher family.
const unrelated='package sample {import flash.events.EventDispatcher; public class Other extends EventDispatcher {public function Other(){super();} override public function toString():String{return "other";}}}';
const mixed={...input,sources:{...input.sources,'sample.Other':record(unrelated)},providers:{...providers,
    'flash.events.EventDispatcher':{module:'./events',exportName:'EventDispatcher',nativeBase:'EventDispatcher'}}};
const mixedPlan=api.createNativeGeneratedDeclarationPlan(mixed);
new Projection(mixedPlan,input.scope,'sample.Other',unrelated);

const dynamic=source.replace('public class Base','public dynamic class Base');
const dynamicPlan=api.createNativeGeneratedDeclarationPlan({...input,sources:{'sample.Base':record(dynamic)}});
assert.equal(new Projection(dynamicPlan,input.scope,'sample.Base',dynamic).metadata.isDynamic,true);guards++;
// Actual retained authored Class must never be admitted as an empty native node.
const authoredPacket=path.join(engine,'tests/nativeFlashOracle/ui-cheatpanel-construction');
require(path.join(authoredPacket,'verify.cjs'));
const authoredFile=fs.readdirSync(path.join(authoredPacket,'source'),{recursive:true}).find(f=>f.endsWith('UI_CheatPanel.as'));
const authored=fs.readFileSync(path.join(authoredPacket,'source',authoredFile),'utf8');
assert.throws(()=>api.createNativeGeneratedDeclarationPlan({...input,sources:{'cn.kyiax.gui.basis.UI_CheatPanel':record(authored)}}),/Embed Class requires authenticated authored symbol construction/);guards++;
// Reference-only MovieClip authority does not grant construction, nor retry authority.
assert.throws(()=>api.createNativeGeneratedDeclarationPlan({...input,providers:{...providers,'flash.display.MovieClip':{module:'./reference',exportName:'MovieClip'}}}),/base requires a planned source declaration/);guards++;
assert.throws(()=>api.createNativeGeneratedDeclarationPlan({...input,scriptGlobalProviderModule:'./globals',scriptDomainProvider:{module:'./domain',exportName:'domain'},inheritScriptClasses:true,lexicalProviderModule:'./lexical',classScriptSources:['sample.Base']}),/non-retrying source root parent/);guards++;
console.log(JSON.stringify({traits:105,referenceTypes:references.length,guards,status:'passed',scope:'projection'}));
