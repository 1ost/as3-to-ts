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
const playwright=process.env.LAYA_PLAYWRIGHT_MODULE;

test('Flash EventDispatcher retains a pre-super listener for post-super dispatch in Chromium',
 {skip:!laya||!air||!ffdec||!playwright},async t=>{
  const oracle=path.join(fs.realpathSync(laya),'tests/nativeFlashOracle/pre-super-event-listener');
  const evidence=JSON.parse(fs.readFileSync(path.join(oracle,'native-air.json'),'utf8'));
  assert.equal(evidence.schema,'native-pre-super-event-listener@1');
  assert.equal(evidence.runs,2);
  assert.equal(evidence.identical,true);
  const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'pre-super-event-listener-')));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const source=path.join(dir,'source'),profile=path.join(dir,'profile'),output=path.join(dir,'output');
  fs.mkdirSync(source);
  for(const name of ['Base','Child','Log'])
    fs.copyFileSync(path.join(oracle,'source',name+'.as'),path.join(source,name+'.as'));
  fs.writeFileSync(path.join(source,'Application.as'),
    'package { public class Application extends Child { public function Application() { super(true); } } }\n');
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
  assert.equal(rows.length,4);
  assert.ok(rows.every(row=>row.typescriptSha256),JSON.stringify(rows));

  const changedSource=path.join(dir,'changed-source'),changedProfile=path.join(dir,'changed-profile');
  fs.mkdirSync(changedSource);
  for(const name of ['Application','Base','Log'])
    fs.copyFileSync(path.join(source,name+'.as'),path.join(changedSource,name+'.as'));
  const childSource=fs.readFileSync(path.join(source,'Child.as'),'utf8');
  assert.ok(childSource.includes('this.button.addEventListener('));
  fs.writeFileSync(path.join(changedSource,'Child.as'),childSource.replace(
    'this.button.addEventListener(',
    'this.button = new EventDispatcher();\n   this.button.addEventListener('));
  run('python3',['-B','tools/create-fixture-profile.py','--source',changedSource,'--entry','Application',
    '--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',changedProfile]);
  const changedOutput=path.join(dir,'changed-output');
  run(process.execPath,['bin/as3-frontend','qualify',changedSource,changedOutput,'--source-census',
    path.join(changedProfile,'census.json'),'--target-capabilities',
    path.join(laya,'docTool/architecture/authored-content-capabilities.json'),
    '--profile-lock',path.join(changedProfile,'profile-lock.json')]);
  const changed=JSON.parse(fs.readFileSync(path.join(changedOutput,'manifest.json'),'utf8')).files;
  assert.equal(changed.find(row=>row.sourcePath==='Child.as').code,'HARDENED_SUPER_LOCAL_RECEIVER');

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
import {as3BindDeferredPreSuperMethod} from ${JSON.stringify(path.join(runtime,'AS3Authority.generated.js'))};
globalThis.completion=Laya.init(800,600).then(()=>{
 startAS3Application(new AbortController().signal);
 const Child=AS3_APPLICATION_MODULES.find(module=>module.Child)?.Child;
 const Log=AS3_APPLICATION_MODULES.find(module=>module.Log)?.Log;
 new Child(false);
 globalThis.observedRows=Log.rows.slice();
 const preview={record(){throw Error('unsafe callback ran');}};
 const early=as3BindDeferredPreSuperMethod(preview,preview.record);
 try{early();globalThis.earlyRejected=false;}
 catch(error){globalThis.earlyRejected=error instanceof TypeError &&
  /before base construction/.test(error.message);}
});`;
  const built=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'js'},
    bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',
    loader:{'.glsl':'text','.fs':'text','.vs':'text','.wgsl':'text'},
    alias:{'laya/flash':path.join(layaSource,'flash')}});
  const {chromium}=require(playwright);
  const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=swiftshader']});
  try{
    const page=await browser.newPage();
    await page.route('http://pre-super-listener.test/**',route=>route.request().url().endsWith('/bundle.js')
      ? route.fulfill({contentType:'text/javascript',body:built.outputFiles[0].text})
      : route.fulfill({contentType:'text/html',body:'<!doctype html><body><script src="/bundle.js"></script>'}));
    await page.goto('http://pre-super-listener.test/');
    await page.evaluate(()=>globalThis.completion);
    assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.observedRows))),evidence.rows);
    assert.equal(await page.evaluate(()=>globalThis.earlyRejected),true);
  }finally{await browser.close();}
});
