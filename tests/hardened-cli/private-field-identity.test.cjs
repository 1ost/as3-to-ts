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

test('private fields retain owner-qualified AS3 identity across inheritance',async t=>{
 assert.ok(laya&&air&&ffdec,'AIR, Laya and FFDec required');
 const fixture=path.join(laya,'tests/nativeFlashOracle/private-field-identity');
 const evidence=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'),'utf8'));
 for(const sourceFile of evidence.sourceFiles)
  assert.equal(sha(fs.readFileSync(path.join(fixture,sourceFile.path))),sourceFile.sha256,sourceFile.path);
 assert.equal(evidence.capture.runtime.version,'MAC 51,3,3,2');
 assert.equal(evidence.capture.state.observations.length,3);

 const directory=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'private-field-identity-')));
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const source=path.join(directory,'source'),profile=path.join(directory,'profile');fs.mkdirSync(source);
 for(const sourceFile of evidence.sourceFiles)
  fs.writeFileSync(path.join(source,sourceFile.path),fs.readFileSync(path.join(fixture,sourceFile.path)));
 const run=(command,args)=>{
  const result=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:180000});
  assert.equal(result.status,0,result.stdout+result.stderr);return result;
 };
 run('python3',['-B','tools/create-fixture-profile.py','--source',source,
  '--entry','PrivateFieldIdentityProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);
 const output=path.join(directory,'output');
 run(process.execPath,['bin/as3-frontend','transpile',source,output,
  '--source-census',path.join(profile,'census.json'),
  '--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),
  '--profile-lock',path.join(profile,'profile-lock.json')]);
 const manifest=JSON.parse(fs.readFileSync(path.join(output,'manifest.json'),'utf8'));
 assert.equal(manifest.files.length,3);
 for(const row of manifest.files) assert.equal(typeof row.typescriptPath,'string',JSON.stringify(row));
 const baseRow=manifest.files.find(row=>row.sourcePath==='PrivateFieldBase.as');
 const middleRow=manifest.files.find(row=>row.sourcePath==='PrivateFieldMiddle.as');
 const baseCode=fs.readFileSync(path.join(output,baseRow.typescriptPath),'utf8');
 const middleCode=fs.readFileSync(path.join(output,middleRow.typescriptPath),'utf8');
 const baseStorage=/private (__as3PrivateField_[A-Za-z0-9_$]+_slot): number/.exec(baseCode)?.[1];
 const middleStorage=/private (__as3PrivateField_[A-Za-z0-9_$]+_slot): number/.exec(middleCode)?.[1];
 assert.ok(baseStorage,baseCode);assert.ok(middleStorage,middleCode);assert.notEqual(baseStorage,middleStorage);
 assert.match(baseCode,new RegExp(`this\\.${baseStorage} = __as3Int\\(1\\)`));
 assert.match(middleCode,new RegExp(`this\\.${middleStorage} = __as3Int\\(2\\)`));

 const application=path.join(output,'__as3_runtime/ApplicationEntry.generated.js');
 const entry=`import {startAS3Application} from ${JSON.stringify(application)};
const probe=startAS3Application(new AbortController().signal);
globalThis.privateFieldState=probe.snapshot();`;
 const built=await require('esbuild').build({stdin:{contents:entry,resolveDir:root,loader:'js'},bundle:true,
  write:false,format:'iife',platform:'browser',target:'es2020'});
 const actual=JSON.parse(JSON.stringify(new Function(built.outputFiles[0].text+
  ';return globalThis.privateFieldState;')()));
 assert.deepEqual(actual,evidence.capture.state);
 console.log(JSON.stringify({directory,status:'passed',observations:actual.observations.length,
  privateStorageNames:[baseStorage,middleStorage]}));
});
