'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict'),crypto=require('crypto'),{createRequire}=require('module');
const test=require('node:test'),os=require('node:os');
const compiler=path.resolve(__dirname,'../..'),laya=process.env.FROZEN_LAYA_ROOT||process.env.HARDENED_FIXTURE_LAYA;
const air=process.env.HARDENED_FIXTURE_AIR_SDK,ffdec=process.env.HARDENED_FIXTURE_FFDEC;
test('generated source-shaped callbacks preserve binding, conditional registration and revocation', {skip:!laya&&!air&&!ffdec}, t=>{
assert.ok(laya&&air&&ffdec,'FROZEN_LAYA_ROOT/HARDENED_FIXTURE_LAYA, HARDENED_FIXTURE_AIR_SDK and HARDENED_FIXTURE_FFDEC are required');
const output=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'external-callback-generated-')));let completed=false;
t.after(()=>{if(completed)fs.rmSync(output,{recursive:true,force:true});else console.error('Retained callback regression evidence: '+output);});
const source=path.join(__dirname,'fixtures/external-callback-source'),file=path.join(source,'SourceCallbackProbe.as'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const expected='44fe6c3043c6f3e2b3f25107b8629b0d3363f78e03885aeffec22ce8dd8efde4';assert.equal(sha(fs.readFileSync(file)),expected);
const local=createRequire(path.join(compiler,'package.json')),profile=path.join(output,'profile'),target=path.join(laya,'docTool/architecture/authored-content-capabilities.json');
const run=(cmd,args)=>{const r=cp.spawnSync(cmd,args,{cwd:compiler,encoding:'utf8',timeout:180000});fs.appendFileSync(path.join(output,'commands.log'),JSON.stringify([cmd,...args])+'\n'+r.stdout+r.stderr);assert.equal(r.status,0,r.stdout+r.stderr);};
run('python3',['-B',path.join(compiler,'tools/create-fixture-profile.py'),'--source',source,'--entry','SourceCallbackProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);
const snapshots=[];
for(const label of ['first','second']){
 const destination=path.join(output,label),args=['--source-census',path.join(profile,'census.json'),'--target-capabilities',target,'--profile-lock',path.join(profile,'profile-lock.json')];
 run(process.execPath,[path.join(compiler,'bin/as3-frontend'),'qualify',source,destination+'-qualified',...args]);
 const qualified=JSON.parse(fs.readFileSync(destination+'-qualified/manifest.json'));assert.equal(qualified.files.length,1);assert.equal(qualified.files[0].status,'admitted');assert.equal(qualified.files[0].sourceSha256,expected);
 run(process.execPath,[path.join(compiler,'bin/as3-frontend'),'transpile',source,destination,...args]);
 const manifest=JSON.parse(fs.readFileSync(path.join(destination,'manifest.json')));assert.equal(manifest.files[0].sourceSha256,expected);
 snapshots.push(manifest.files.map(row=>[row.sourcePath,fs.readFileSync(path.join(destination,row.typescriptPath),'utf8')]));
 const modules=path.join(destination,'node_modules/@laya');fs.mkdirSync(modules,{recursive:true});fs.symlinkSync(path.join(destination,'__as3_runtime'),path.join(modules,'as3-runtime'),'dir');
 const bundle=path.join(destination,'runner.cjs');
 local('esbuild').buildSync({stdin:{contents:'exports.entry=require("./__as3_runtime/ApplicationEntry.generated.js"); exports.object=require("@laya/as3-runtime/AS3Object"); exports.host=require("laya/flash/external/ExternalInterface");',resolveDir:destination,sourcefile:'runner.js'},outfile:bundle,bundle:true,platform:'node',format:'cjs',alias:{laya:path.join(laya,'src/layaAir')},logLevel:'silent'});
 const loaded=require(bundle),Probe=loaded.entry.AS3_APPLICATION_MODULES.find(m=>m.SourceCallbackProbe).SourceCallbackProbe,probe=new Probe(),callbacks=new Map();
 const lease=loaded.host.installNativeExternalInterfaceHost({call(){return null;},registerCallback(name,callback){callbacks.set(name,callback);return()=>{if(callbacks.get(name)===callback)callbacks.delete(name);};}});
 try{
  probe.register(loaded.object.as3ObjectLiteral([]));assert.deepEqual([...callbacks.keys()],['CallAsFun']);
  const callback=callbacks.get('CallAsFun');assert.equal(Reflect.apply(callback,{unrelated:true},[]),'bound callback');assert.equal(probe.callbackCount,1);
  probe.register(loaded.object.as3ObjectLiteral([['clientAutomation','1']]));assert.deepEqual([...callbacks.keys()].sort(),['CallAsFun','apAutomationCommand']);
  assert.equal(callbacks.get('CallAsFun')(),'bound callback');assert.equal(probe.callbackCount,2);
  // Object callback registration only: structured host values remain a separate gate.
 }finally{lease.dispose();}
 assert.equal(callbacks.size,0);
}
assert.deepEqual(snapshots[0],snapshots[1]);assert.equal(sha(fs.readFileSync(file)),expected);
fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify({status:'passed',sourceSha256:expected,deterministicRuns:2,primitiveCallbackInvocations:4,structuredCallbackInvocation:'not-tested'},null,2)+'\n');

completed=true;
});
