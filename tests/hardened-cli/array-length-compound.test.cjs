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

test('Array.length += retains native uint storage, raw result and receiver order',async()=>{
 assert.ok(laya&&air&&ffdec,'AIR, Laya and FFDec required');
 const fixture=path.join(laya,'tests/nativeFlashOracle/array-length-compound');
 const evidence=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'),'utf8'));
 for(const source of evidence.sourceFiles)
  assert.equal(sha(fs.readFileSync(path.join(fixture,source.path))),source.sha256,source.path);
 assert.equal(evidence.capture.runtime.version,'MAC 51,3,3,2');
 assert.equal(evidence.capture.state.observations.length,5);

 const directory=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'array-length-compound-')));
 const source=path.join(directory,'source'),profile=path.join(directory,'profile');fs.mkdirSync(source);
 const compiled=`package {
 public final class ArrayLengthCompoundCompiled {
  private var current:Array=[];
  private var events:Array=[];
  private function right(value:Number,rebind:Boolean):Number {events.push("right");if(rebind)current=[9];return value;}
  public function ordinary(delta:Number):Array {current=[1,2,3];var returned:*=(current.length+=delta);return [current.length,returned,String(current[0]),String(current[3])];}
  public function rebind():Array {events=[];current=[1,2,3];var original:Array=current;var returned:*=(current.length+=right(2,true));return [original.length,current.length,returned,String(current[0]),String(current[1]),events.join("|")];}
  public function statement():Array {current=[1,2,3];current.length+=2;return [current.length,String(current[3])];}
  public function nullOrder():Array {events=[];current=null;try {var returned:*=(current.length+=right(2,false));return [returned,events.join("|")];}catch(error:Error){return [error.toString(),events.join("|")];}return [];}
 }
}\n`;
 fs.writeFileSync(path.join(source,'ArrayLengthCompoundCompiled.as'),compiled);
 fs.writeFileSync(path.join(source,'ArrayLengthSubtract.as'),
  'package {public final class ArrayLengthSubtract {public function run(value:Array):void {value.length-=1;}}}\n');
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:180000});
  assert.equal(result.status,0,result.stdout+result.stderr);return result;};
 const makeProfile=(rootSource,output)=>run('python3',['-B','tools/create-fixture-profile.py','--source',rootSource,
  '--entry','ArrayLengthCompoundCompiled','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',output]);
 makeProfile(source,profile);
 const argumentsFor=output=>[source,output,'--source-census',path.join(profile,'census.json'),
  '--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),
  '--profile-lock',path.join(profile,'profile-lock.json')];
 const qualified=path.join(directory,'qualified');
 run(process.execPath,['bin/as3-frontend','qualify',...argumentsFor(qualified)]);
 const rows=JSON.parse(fs.readFileSync(path.join(qualified,'manifest.json'),'utf8')).files;
 const positive=rows.find(row=>row.sourcePath==='ArrayLengthCompoundCompiled.as');
 assert.equal(positive?.status,'admitted',JSON.stringify(positive));
 const negative=rows.find(row=>row.sourcePath==='ArrayLengthSubtract.as');
 assert.equal(negative?.status,'held',JSON.stringify(negative));
 assert.equal(negative?.code,'HARDENED_ARRAY_LENGTH_COMPOUND',JSON.stringify(negative));

 const positiveSource=path.join(directory,'positive-source'),positiveProfile=path.join(directory,'positive-profile');
 fs.mkdirSync(positiveSource);fs.writeFileSync(path.join(positiveSource,'ArrayLengthCompoundCompiled.as'),compiled);
 makeProfile(positiveSource,positiveProfile);
 const output=path.join(directory,'output');
 run(process.execPath,['bin/as3-frontend','transpile',positiveSource,output,
  '--source-census',path.join(positiveProfile,'census.json'),
  '--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),
  '--profile-lock',path.join(positiveProfile,'profile-lock.json')]);
 const manifest=JSON.parse(fs.readFileSync(path.join(output,'manifest.json'),'utf8'));
 const emitted=manifest.files.find(row=>row.sourcePath==='ArrayLengthCompoundCompiled.as');
 assert.equal(typeof emitted?.typescriptPath,'string',JSON.stringify(emitted));
 const generated=fs.readFileSync(path.join(output,emitted.typescriptPath),'utf8');
 assert.match(generated,/__as3ArrayLengthWrite/);
 assert.match(generated,/__as3AssignmentValue/);

 const application=path.join(output,'__as3_runtime/ApplicationEntry.generated.js');
 const entry=`import {startAS3Application} from ${JSON.stringify(application)};
const probe=startAS3Application(new AbortController().signal);
globalThis.arrayLengthCompoundRows=[
 {id:'ordinary',result:probe.ordinary(2)},
 {id:'fraction',result:probe.ordinary(1.5)},
 {id:'receiver-rebind',result:probe.rebind()},
 {id:'statement',result:probe.statement()},
 {id:'null-receiver-order',result:probe.nullOrder()}
];`;
 const built=await require('esbuild').build({stdin:{contents:entry,resolveDir:root,loader:'js'},bundle:true,
  write:false,format:'iife',platform:'browser',target:'es2020'});
 const actual=JSON.parse(JSON.stringify(new Function(built.outputFiles[0].text+
  ';return globalThis.arrayLengthCompoundRows;')()));
 assert.deepEqual(actual,evidence.capture.state.observations);
 console.log(JSON.stringify({directory,status:'passed',observations:actual.length,negativeControls:1}));
});
