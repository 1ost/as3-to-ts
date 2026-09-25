'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;

test('native RangeError fixture preserves source/contracts and generated Error behavior',t=>{
 assert.ok(air&&laya&&ffdec,'AIR, Laya and FFDec paths required');
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'range-error-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,'source'),profile=path.join(dir,'profile'),fixture=process.env.HARDENED_FIXTURE_SOURCE||path.join(laya,'tests/nativeFlashOracle/range-error-construction');fs.mkdirSync(source);
 const retained=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'))),name='RangeErrorConstructionProbe.as',bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha(bytes),retained.sourceFiles[name]);assert.equal(sha(fs.readFileSync(path.join(fixture,'scenario.json'))),retained.scenarioSha256);fs.writeFileSync(path.join(source,name),bytes);
 const run=(command,args)=>{const r=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);};
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','RangeErrorConstructionProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);
 const compile=(op,out)=>run(process.execPath,['bin/as3-frontend',op,source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
 make();const snapshots=[];
 for(const out of ['first','second']){
  compile('transpile',out);const rows=JSON.parse(fs.readFileSync(path.join(dir,out,'manifest.json'))).files;assert.equal(rows.length,1);assert.equal(rows[0].sourceSha256,sha(bytes));
  const packageRoot=path.join(dir,out,'__as3_runtime'),code=fs.readFileSync(path.join(packageRoot,'application/RangeErrorConstructionProbe.ts'),'utf8');assert.match(code,/new __AS3RangeError\(/);assert.doesNotMatch(code,/new RangeError\(/);
  const packageInfo=JSON.parse(fs.readFileSync(path.join(packageRoot,'package.json'))),local=require('node:module').createRequire(path.join(packageRoot,'application/RangeErrorConstructionProbe.js'));
  const runtime=local(packageInfo.name+'/AS3Error');assert.equal(typeof runtime.AS3RangeError,'function');
  const modules=local(packageInfo.name+'/ApplicationEntry').AS3_APPLICATION_MODULES;const Probe=modules.find(module=>module.RangeErrorConstructionProbe)?.RangeErrorConstructionProbe;assert.ok(Probe);const probe=new Probe();
  const scenario=JSON.parse(fs.readFileSync(path.join(fixture,'scenario.json'))),native=new Map(retained.capture.state.observations.map(row=>[row.id,row.result]));
  for(const step of scenario.steps){const call=step.calls[0];probe.exercise(...call.args);assert.deepEqual(probe.result,native.get(step.id),step.id);}
  snapshots.push([rows,code]);
 }
 assert.deepEqual(snapshots[0],snapshots[1]);assert.equal(sha(fs.readFileSync(path.join(source,name))),sha(bytes));
 const negative={Extra:{params:'',expression:'new RangeError("x",1,2)',code:'HARDENED_RANGE_ERROR_CONSTRUCTOR'},UnknownId:{params:'id:*',expression:'new RangeError("x",id)',code:'HARDENED_RANGE_ERROR_IDENTIFIER'},ObjectId:{params:'id:Object',expression:'new RangeError("x",id)',code:'HARDENED_RANGE_ERROR_IDENTIFIER'},Shadow:{params:'RangeError:Object',expression:'new RangeError()',code:null}};
 for(const [name,item] of Object.entries(negative))fs.writeFileSync(path.join(source,name+'.as'),`package {public class ${name} {public function make(${item.params}):Error{return ${item.expression};}}}`);
 fs.rmSync(profile,{recursive:true,force:true});make();compile('qualify','negative');const rows=JSON.parse(fs.readFileSync(path.join(dir,'negative/manifest.json'))).files;
 for(const [name,item] of Object.entries(negative)){const row=rows.find(row=>row.sourcePath===name+'.as');assert.equal(row?.status,'held',JSON.stringify(row));if(item.code)assert.equal(row.code,item.code,JSON.stringify(row));}
});
