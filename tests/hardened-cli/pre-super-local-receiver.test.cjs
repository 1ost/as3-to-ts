'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const esbuild=require('esbuild');

const root=path.resolve(__dirname,'../..');
const laya=process.env.HARDENED_FIXTURE_LAYA;
const air=process.env.HARDENED_FIXTURE_AIR_SDK;
const ffdec=process.env.HARDENED_FIXTURE_FFDEC;
const playwright=process.env.LAYA_PLAYWRIGHT_MODULE;
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('local pre-super virtual receiver matches the two-run AIR oracle in Chromium',
 {skip:!laya||!air||!ffdec||!playwright},async t=>{
  const oracle=path.join(fs.realpathSync(laya),'tests/nativeFlashOracle/pre-super-local-dispatch');
  const evidence=JSON.parse(fs.readFileSync(path.join(oracle,'native-air.json'),'utf8'));
  assert.equal(evidence.schema,'native-pre-super-local-dispatch@1');
  assert.equal(evidence.identical,true);
  assert.equal(evidence.runs,2);
  const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'pre-super-local-receiver-')));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const source=path.join(dir,'source'),profile=path.join(dir,'profile'),output=path.join(dir,'output');
  fs.mkdirSync(source);
  for(const name of ['Root','Base','Child','Log']){
   const relative='source/'+name+'.as';
   const bytes=fs.readFileSync(path.join(oracle,relative));
   assert.equal(sha(bytes),evidence.sourceSha256[relative],relative);
   fs.writeFileSync(path.join(source,name+'.as'),bytes);
  }
  fs.writeFileSync(path.join(source,'Application.as'),
   'package { public class Application extends Child { public function Application() { super(7); } } }\n');
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
  assert.equal(rows.length,5);
  assert.ok(rows.every(row=>row.typescriptSha256),JSON.stringify(rows));
  const generated=fs.readFileSync(path.join(output,'__as3_runtime/application/Base.ts'),'utf8');
  assert.match(generated,/protected declare value: number/);

  const layaSource=path.join(laya,'src/layaAir');
  const runtime=path.join(output,'__as3_runtime');
  const bootstrap=['laya/ModuleDef','laya/ui/ModuleDef','laya/platform/BrowserAdapter',
   'laya/platform/FileSystemAdapter','laya/platform/FontAdapter','laya/platform/MediaAdapter',
   'laya/platform/StorageAdapter','laya/platform/TextInputAdapter','laya/device/WebDeviceAdapter',
   'laya/RenderDriver/RenderModuleData/WebModuleData/WebUnitRenderModuleDataFactory',
   'laya/RenderDriver/WebGLDriver/RenderDevice/WebGLRenderDeviceFactory',
   'laya/RenderDriver/WebGLDriver/2DRenderPass/WebGLRender2DProcess']
   .map(name=>`import ${JSON.stringify(path.join(layaSource,name+'.ts'))};`).join('\n');
  const entry=bootstrap+`\nimport {Laya} from ${JSON.stringify(path.join(layaSource,'Laya.ts'))};
import {startAS3Application,AS3_APPLICATION_MODULES} from ${JSON.stringify(path.join(runtime,'ApplicationEntry.generated.js'))};
globalThis.completion=Laya.init(800,600).then(()=>{
 const first=startAS3Application(new AbortController().signal);
 const Child=AS3_APPLICATION_MODULES[2].Child,Log=AS3_APPLICATION_MODULES[3].Log;
 Log.rows.push('final:'+first.readValue());
 const second=new Child(-1);
 Log.rows.push('fallback-final:'+second.readValue());
 globalThis.observedRows=Log.rows;
 const descriptor=Object.getOwnPropertyDescriptor(Child.prototype,'getBg');
 Object.defineProperty(Child.prototype,'getBg',{...descriptor,value(){return 'tampered';}});
 try{new Child(2);globalThis.tamperRejected=false;}
 catch(error){globalThis.tamperRejected=error instanceof TypeError &&
  /pre-super method proof/.test(error.message);}
 Object.defineProperty(Child.prototype,'getBg',descriptor);
});`;
  const built=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'js'},
   bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',
   loader:{'.glsl':'text','.fs':'text','.vs':'text','.wgsl':'text'},
   alias:{'laya/flash':path.join(layaSource,'flash')}});
  const {chromium}=require(playwright);
  const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=swiftshader']});
  try{
   const page=await browser.newPage();
   page.on('pageerror',error=>console.error('pre-super browser error',error));
   await page.route('http://pre-super-local.test/**',route=>route.request().url().endsWith('/bundle.js')
    ? route.fulfill({contentType:'text/javascript',body:built.outputFiles[0].text})
    : route.fulfill({contentType:'text/html',body:'<!doctype html><body><script src="/bundle.js"></script>'}));
   await page.goto('http://pre-super-local.test/');
   await page.evaluate(()=>globalThis.completion);
   assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.observedRows))),evidence.rows);
   assert.equal(await page.evaluate(()=>globalThis.tamperRejected),true);
  }finally{await browser.close();}
 });
