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
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');

test('case-inert ignore-case RegExp literal preserves native tag replacement and keeps case folding held',async()=>{
 assert.ok(laya&&process.env.HARDENED_FIXTURE_AIR_SDK&&process.env.HARDENED_FIXTURE_FFDEC,'AIR, Laya and FFDec required');
 const fixture=path.join(laya,'tests/nativeFlashOracle/regexp-case-inert-ignore-case');
 const evidence=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'),'utf8'));
 const sourceBytes=fs.readFileSync(path.join(fixture,'CaseInertIgnoreCaseOperation.as'));
 assert.equal(sha(sourceBytes),evidence.sourceFiles['CaseInertIgnoreCaseOperation.as']);
 assert.equal(evidence.receipt.capture.runs,2);
 assert.equal(evidence.receipt.capture.identical,true);
 assert.equal(evidence.capture.runtime.version,'MAC 51,3,3,2');

 const base=path.join(root,'.cache/case-inert-ignore-case');fs.mkdirSync(base,{recursive:true});
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(base,'run-'))),source=path.join(dir,'source'),profile=path.join(dir,'profile');
 fs.mkdirSync(source);fs.writeFileSync(path.join(source,'CaseInertIgnoreCaseOperation.as'),sourceBytes);
 const negatives={
  CaseSensitiveLiteral:'/a/i',
  CaseSensitiveClass:'/[^A]/i',
  NonAsciiLiteral:'/é/i',
  UnsupportedFlag:'/<[^>]+>/m'
 };
 for(const [name,literal] of Object.entries(negatives)) fs.writeFileSync(path.join(source,name+'.as'),
  `package {public class ${name} {public function run(value:String):String {return value.replace(${literal},"");}}}`);
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(result.status,0,result.stdout+result.stderr);};
 run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','CaseInertIgnoreCaseOperation','--native-regexp',
  '--air-sdk',process.env.HARDENED_FIXTURE_AIR_SDK,'--laya',laya,'--ffdec-jar',process.env.HARDENED_FIXTURE_FFDEC,'--output',profile]);
 const qualified=path.join(dir,'qualified');
 run(process.execPath,['bin/as3-frontend','qualify',source,qualified,'--source-census',path.join(profile,'census.json'),
  '--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
 const manifest=JSON.parse(fs.readFileSync(path.join(qualified,'manifest.json'),'utf8'));
 const positive=manifest.files.find(row=>row.sourcePath==='CaseInertIgnoreCaseOperation.as');
 assert.equal(positive?.status,'admitted',JSON.stringify(positive));
 for(const name of Object.keys(negatives)) {
  const row=manifest.files.find(candidate=>candidate.sourcePath===name+'.as');
  assert.equal(row?.status,'held',JSON.stringify(row));
  assert.equal(row?.code,'HARDENED_REGEXP_GRAMMAR',JSON.stringify(row));
 }
 const positiveSource=path.join(dir,'positive-source'),positiveProfile=path.join(dir,'positive-profile');
 fs.mkdirSync(positiveSource);fs.writeFileSync(path.join(positiveSource,'CaseInertIgnoreCaseOperation.as'),sourceBytes);
 run('python3',['-B','tools/create-fixture-profile.py','--source',positiveSource,'--entry','CaseInertIgnoreCaseOperation','--native-regexp',
  '--air-sdk',process.env.HARDENED_FIXTURE_AIR_SDK,'--laya',laya,'--ffdec-jar',process.env.HARDENED_FIXTURE_FFDEC,'--output',positiveProfile]);
 const output=path.join(dir,'emitted');
 run(process.execPath,['bin/as3-frontend','transpile',positiveSource,output,'--source-census',path.join(positiveProfile,'census.json'),
  '--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(positiveProfile,'profile-lock.json')]);
 const packageRoot=path.join(output,'__as3_runtime');
 const generated=fs.readFileSync(path.join(packageRoot,'application/CaseInertIgnoreCaseOperation.ts'),'utf8');
 assert.match(generated,/AS3RegExp/);assert.match(generated,/"gi"/);assert.match(generated,/__as3SourceRegExpReplace/);
 const esbuild=require('esbuild');
 const rows=evidence.capture.state.observations.slice(1);
 const entry=`import {startAS3Application} from ${JSON.stringify(path.join(packageRoot,'ApplicationEntry.generated.js'))};
const operation=startAS3Application(new AbortController().signal);
globalThis.caseInertResult=${JSON.stringify(rows)}.map(row=>({id:row.id,value:row.value,result:operation.replace(row.value)}));`;
 const built=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'js'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',
  loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'},plugins:[{name:'laya-provider',setup(build){build.onResolve({filter:/^laya\//},args=>({path:path.join(laya,'src/layaAir',args.path.slice(5)+'.ts')}));}}]});
 const actual=JSON.parse(JSON.stringify(new Function(built.outputFiles[0].text+';return globalThis.caseInertResult;')()));
 assert.deepEqual(actual,rows);
 console.log(JSON.stringify({dir,status:'passed',observations:actual.length,negativeControls:Object.keys(negatives).length}));
});
