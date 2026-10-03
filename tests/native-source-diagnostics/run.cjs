'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const api=require('../../lib'),internal=require('../../lib/emit/native-generated-declarations');
const {compile}=require('../native-generated-object-accessors/compile.cjs');
const root=path.resolve(__dirname,'../..'),outputRoot=path.join(root,'.cache/native-source-diagnostics');
fs.mkdirSync(outputRoot,{recursive:true});const out=fs.mkdtempSync(path.join(outputRoot,'run-'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const texts={
 'cases.AFirstHeld':'package cases { public class AFirstHeld { public static var value:Object = {}; } }',
 'cases.Good':'package cases { public class Good { public function answer():int { return 42; } } }',
 'cases.ZLastHeld':'package cases { public class ZLastHeld { public static var value:Array = []; } }',
 'cases.IGood':'package cases { public interface IGood { function answer():int; } }'
};
const sourceUnits=names=>Object.fromEntries(names.map(q=>[q,{source:texts[q],sourceSha256:hash(texts[q])}]));
const reports=[];
for(const target of ['ES5','ES2015']){
 const base=compile(path.join(out,target),target),planned=internal.nativeGeneratedDeclarationInputs(base.plan,base.plan.scope);
 function config(names){
  const plan=api.createNativeGeneratedDeclarationPlan({...planned,scope:'source-diagnostics-'+target,sources:sourceUnits(names)});
  return {...base.config,plan,emitterOptions:{...base.config.emitterOptions,definitionsByNamespace:{cases:names.map(q=>q.split('.').pop())},nativeReferenceCoercion:{...base.config.emitterOptions.nativeReferenceCoercion,plan}}};
 }
 const input=config(Object.keys(texts)),attempts=[],original=api.Emitter.emit;
 api.Emitter.emit=function(ast,source,opts){attempts.push(opts.nativeGeneratedDeclarations?.declarationIdentity||opts.nativeVectorTypes?.declarationIdentity);return original(ast,source,opts);};
 let firstError,aggregate;
 try{
  assert.throws(()=>api.emitNativeSourceClassModule(input),e=>{firstError=e;return /static initializer requires retry identity authority/.test(e.message);});
  assert.deepEqual(attempts,['cases.AFirstHeld']);assert.equal(firstError.sourceDiagnostics,undefined);
  attempts.length=0;
  assert.throws(()=>api.emitNativeSourceClassModule({...input,collectSourceErrors:true}),e=>{aggregate=e;return /source emission held for 2 declarations/.test(e.message);});
  assert.deepEqual(attempts,['cases.AFirstHeld','cases.Good','cases.ZLastHeld','cases.IGood']);
  assert.deepEqual(aggregate.sourceDiagnostics.map(d=>d.identity),['cases.AFirstHeld','cases.ZLastHeld']);
  assert.equal(aggregate.sourceDiagnostics[0].message,firstError.message);
  for(const diagnostic of aggregate.sourceDiagnostics){assert.equal(diagnostic.sourceOwner,diagnostic.identity);assert.equal(diagnostic.sourceSha256,hash(texts[diagnostic.identity]));assert.match(diagnostic.message,/static initializer requires retry identity authority/);assert(Object.isFrozen(diagnostic));}
  assert(Object.isFrozen(aggregate.sourceDiagnostics));assert.throws(()=>aggregate.sourceDiagnostics.push({}),TypeError);
  for(const key of ['moduleSource','generatedSources','declarationSource'])assert.equal(aggregate[key],undefined);
  // A repeat on the same authenticated plan must retain the same failures.
  assert.throws(()=>api.emitNativeSourceClassModule({...input,collectSourceErrors:true}),e=>{assert.deepEqual(e.sourceDiagnostics,aggregate.sourceDiagnostics);return true;});
  const good=config(['cases.Good','cases.IGood']);
  const ordinary=api.emitNativeSourceClassModule(good);
  assert.deepEqual(api.emitNativeSourceClassModule({...good,collectSourceErrors:true}),ordinary);
  assert.deepEqual(api.emitNativeSourceClassModule({...good,collectSourceErrors:false}),ordinary);
  assert.deepEqual(api.emitNativeSourceClassModule({...base.config,collectSourceErrors:true}),base.artifact);
  attempts.length=0;
  assert.throws(()=>api.emitNativeSourceClassModule({...good,collectSourceErrors:'yes'}),/collectSourceErrors must be a boolean/);assert.equal(attempts.length,0);
  assert.throws(()=>api.emitNativeSourceClassModule({...good,collectSourceErrors:true,externalModules:[]}),/must be explicit external modules/);assert.equal(attempts.length,0);
  // Exercise the interface error branch at the emitter seam; no production source substitutes.
  api.Emitter.emit=function(ast,source,opts){if(opts.nativeVectorTypes?.declarationIdentity==='cases.IGood')throw Error('test interface emission failure');return original(ast,source,opts);};
  assert.throws(()=>api.emitNativeSourceClassModule({...good,collectSourceErrors:true}),e=>{assert.deepEqual(e.sourceDiagnostics,[{identity:'cases.IGood',sourceOwner:'cases.IGood',sourceSha256:hash(texts['cases.IGood']),message:'test interface emission failure'}]);return true;});
  texts['cases.Local']='package cases { public class Local {} } class Helper {} interface ILocal { function run():void; }';
  const local=config(['cases.Local']),helper=local.plan.privateBindings[0].identity,privateInterface=local.plan.privateInterfaces[0].identity;
  api.Emitter.emit=original;
  const localArtifact=api.emitNativeSourceClassModule(local);
  assert.deepEqual(api.emitNativeSourceClassModule({...local,collectSourceErrors:true}),localArtifact);
  api.Emitter.emit=function(ast,source,opts){if(opts.nativeGeneratedDeclarations?.declarationIdentity===helper)throw Error('test private emission failure');return original(ast,source,opts);};
  assert.throws(()=>api.emitNativeSourceClassModule({...local,collectSourceErrors:true}),e=>{assert.deepEqual(e.sourceDiagnostics,[{identity:helper,sourceOwner:'cases.Local',sourceSha256:hash(texts['cases.Local']),message:'test private emission failure'}]);return true;});
  api.Emitter.emit=function(ast,source,opts){if(opts.nativeVectorTypes?.declarationIdentity===privateInterface)throw Error('test private interface failure');return original(ast,source,opts);};
  assert.throws(()=>api.emitNativeSourceClassModule({...local,collectSourceErrors:true}),e=>{assert.deepEqual(e.sourceDiagnostics,[{identity:privateInterface,sourceOwner:'cases.Local',sourceSha256:hash(texts['cases.Local']),message:'test private interface failure'}]);return true;});
  delete texts['cases.Local'];
  reports.push({target,sourceFailures:2,attempted:4,unchangedSuccessfulOutput:true,originalAccessorClasses:7,interfaceFailureCaptured:true,privateOwnerCaptured:true,privateInterfaceOwnerCaptured:true,partialModuleReturned:false});
 }finally{api.Emitter.emit=original;}
}
const report={results:reports,scope:'Build-time diagnostic collection only; no runtime behavior changed'};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,...report}));
