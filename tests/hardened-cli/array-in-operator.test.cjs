'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const laya=process.env.HARDENED_FIXTURE_LAYA;
const air=process.env.HARDENED_FIXTURE_AIR_SDK;
const ffdec=process.env.HARDENED_FIXTURE_FFDEC;
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');

test('native Array in lowers through the shared runtime and preserves retained AIR membership',async()=>{
 assert.ok(laya&&air&&ffdec,'AIR, Laya and FFDec required');
 const fixture=path.join(laya,'tests/nativeFlashOracle/array-in-operator');
 const evidence=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'),'utf8'));
 for(const [file,expected] of Object.entries(evidence.sourceFiles))
  assert.equal(sha(fs.readFileSync(path.join(fixture,file))),expected,file);
 assert.equal(evidence.receipt.capture.runs,2);
 assert.equal(evidence.receipt.capture.identical,true);
 assert.equal(evidence.capture.runtime.version,'MAC 51,3,3,2');

 const base=path.join(root,'.cache/array-in-operator');fs.mkdirSync(base,{recursive:true});
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(base,'run-')));
 const source=path.join(dir,'source'),profile=path.join(dir,'profile');fs.mkdirSync(source);
 const operation=fs.readFileSync(path.join(fixture,'ArrayInOperation.as'));
 fs.writeFileSync(path.join(source,'ArrayInOperation.as'),operation);
 fs.writeFileSync(path.join(source,'ArrayInSubclass.as'),`package {
 public final class ArrayInSubclass {
  public function contains(array:ArrayInSubclassValue,key:*):Boolean { return key in array; }
 }
}\n`);
 fs.writeFileSync(path.join(source,'ArrayInSubclassValue.as'),`package {
 public dynamic class ArrayInSubclassValue extends Array {}
}\n`);
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000});
  assert.equal(result.status,0,result.stdout+result.stderr);return result;};
 run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','ArrayInOperation',
  '--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);
 const qualified=path.join(dir,'qualified');
 const args=output=>[source,output,'--source-census',path.join(profile,'census.json'),
  '--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),
  '--profile-lock',path.join(profile,'profile-lock.json')];
 run(process.execPath,['bin/as3-frontend','qualify',...args(qualified)]);
 const manifest=JSON.parse(fs.readFileSync(path.join(qualified,'manifest.json'),'utf8'));
 const positive=manifest.files.find(row=>row.sourcePath==='ArrayInOperation.as');
 assert.equal(positive?.status,'admitted',JSON.stringify(positive));
 const rejected=manifest.files.find(row=>row.sourcePath==='ArrayInSubclass.as');
 assert.equal(rejected?.status,'held',JSON.stringify(rejected));
 assert.equal(rejected?.code,'HARDENED_OBJECT_IN',JSON.stringify(rejected));

 const positiveSource=path.join(dir,'positive-source'),positiveProfile=path.join(dir,'positive-profile');
 fs.mkdirSync(positiveSource);fs.writeFileSync(path.join(positiveSource,'ArrayInOperation.as'),operation);
 run('python3',['-B','tools/create-fixture-profile.py','--source',positiveSource,'--entry','ArrayInOperation',
  '--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',positiveProfile]);
 const output=path.join(dir,'emitted');
 run(process.execPath,['bin/as3-frontend','transpile',positiveSource,output,'--source-census',path.join(positiveProfile,'census.json'),
  '--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),
  '--profile-lock',path.join(positiveProfile,'profile-lock.json')]);
 const packageRoot=path.join(output,'__as3_runtime');
 const generated=fs.readFileSync(path.join(packageRoot,'application/ArrayInOperation.ts'),'utf8');
 assert.match(generated,/__as3ArrayIn\(key, array\)/);
 assert.match(generated,/@laya\/as3-runtime\/AS3Array/);

 const esbuild=require('esbuild');
 const entry=`import {startAS3Application} from ${JSON.stringify(path.join(packageRoot,'ApplicationEntry.generated.js'))};
const operation=startAS3Application(new AbortController().signal);
const rows=[];
const observe=(id,array,key)=>rows.push({id,result:operation.contains(array,key)});
const dense=['zero','one'];observe('dense-number',dense,0);observe('dense-string',dense,'1');observe('dense-missing',dense,2);
const sparse=new Array(3);sparse[1]='one';observe('sparse-hole',sparse,'0');observe('sparse-slot',sparse,1);observe('length',sparse,'length');
dense.reward=9;observe('dynamic-name',dense,'reward');observe('dynamic-missing',dense,'missing');delete dense[0];observe('deleted-index',dense,0);
observe('prototype-push',dense,'push');observe('prototype-to-string',dense,'toString');observe('prototype-constructor',dense,'constructor');observe('prototype-has-own',dense,'hasOwnProperty');
dense[null]='null-key';observe('null-key',dense,null);
const conversionEvents=[];observe('conversion-order',['zero','one'],{toString(){conversionEvents.push('convert');return '1';}});rows.at(-1).events=conversionEvents.join(',');
let nullRow;const nullEvents=[];try{operation.contains(null,{toString(){nullEvents.push('convert');return '0';}});nullRow={id:'null-target',kind:'return'};}
catch(error){nullRow={id:'null-target',kind:'throw',name:error.name,errorID:error.errorID,events:nullEvents.join(',')};}rows.push(nullRow);
globalThis.arrayInRows=rows;`;
 const built=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'js'},bundle:true,write:false,
  format:'iife',platform:'browser',target:'es2020'});
 const actual=JSON.parse(JSON.stringify(new Function(built.outputFiles[0].text+';return globalThis.arrayInRows;')()));
 const expected=evidence.capture.state.observations.map(row=>row.id==='conversion-order'
  ? {...row,events:'convert'} : row.id==='null-target' ? {...row,events:''} : row);
 assert.deepEqual(actual,expected);
 console.log(JSON.stringify({dir,status:'passed',observations:actual.length,negativeControls:1}));
});
