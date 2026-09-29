'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const esbuild=require('esbuild');
const root=path.resolve(__dirname,'../..');
const laya=process.env.HARDENED_FIXTURE_LAYA;
const air=process.env.HARDENED_FIXTURE_AIR_SDK;
const ffdec=process.env.HARDENED_FIXTURE_FFDEC;

test('AS3 package keyword remains a quoted module path, not a TypeScript identifier',
 {skip:!laya||!air||!ffdec},async t=>{
  const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'package-keyword-path-')));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const source=path.join(dir,'source'),profile=path.join(dir,'profile'),output=path.join(dir,'output');
  fs.mkdirSync(path.join(source,'example/enum'),{recursive:true});
  fs.writeFileSync(path.join(source,'example/enum/Words.as'),
    'package example.enum { public class Words { public static const TOKEN:String = "ok"; } }\n');
  fs.writeFileSync(path.join(source,'Application.as'),
    'package { import example.enum.Words; public class Application { public var value:String; '+
    'public function Application() { value = Words.TOKEN; } } }\n');
  const run=(command,args)=>{
    const result=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:240000});
    assert.equal(result.status,0,result.stdout+result.stderr);
  };
  run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','Application',
    '--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);
  run(process.execPath,['bin/as3-frontend','transpile',source,output,'--source-census',
    path.join(profile,'census.json'),'--target-capabilities',
    path.join(laya,'docTool/architecture/authored-content-capabilities.json'),
    '--profile-lock',path.join(profile,'profile-lock.json')]);
  const rows=JSON.parse(fs.readFileSync(path.join(output,'manifest.json'),'utf8')).files;
  assert.equal(rows.length,2);
  assert.ok(rows.every(row=>row.typescriptSha256),JSON.stringify(rows));
  assert.ok(fs.existsSync(path.join(output,'__as3_runtime/application/example/enum/Words.ts')));
  const runtime=path.join(output,'__as3_runtime');
  const entry=`import {startAS3Application} from ${JSON.stringify(path.join(runtime,'ApplicationEntry.generated.js'))};
globalThis.keywordPackageValue=startAS3Application(new AbortController().signal).value;`;
  const built=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'js'},
    bundle:true,write:false,format:'iife',platform:'browser',target:'es2020'});
  new Function(built.outputFiles[0].text)();
  assert.equal(globalThis.keywordPackageValue,'ok');
  delete globalThis.keywordPackageValue;
});
