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

test('local EventDispatcher subclass retains a pre-super listener through its override in Chromium',
 {skip:!laya||!air||!ffdec||!playwright},async t=>{
  const oracle=path.join(fs.realpathSync(laya),'tests/nativeFlashOracle/pre-super-local-listener');
  const evidence=JSON.parse(fs.readFileSync(path.join(oracle,'native-air.json'),'utf8'));
  assert.equal(evidence.schema,'native-pre-super-local-listener@1');
  assert.equal(evidence.runs,2);
  assert.equal(evidence.identical,true);
  const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'pre-super-local-listener-')));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const source=path.join(dir,'source'),profile=path.join(dir,'profile'),output=path.join(dir,'output');
  fs.mkdirSync(source);
  for(const name of ['Base','Child','Log','TrackedDispatcher'])
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
  assert.equal(rows.length,5);
  assert.ok(rows.every(row=>row.typescriptSha256),JSON.stringify(rows));

  const fakeSource=path.join(dir,'fake-source'),fakeProfile=path.join(dir,'fake-profile');
  fs.mkdirSync(fakeSource);
  for(const name of ['Base','Log','Application'])
    fs.copyFileSync(path.join(source,name+'.as'),path.join(fakeSource,name+'.as'));
  fs.writeFileSync(path.join(fakeSource,'FakeDispatcher.as'),
    'package { public class FakeDispatcher { public function FakeDispatcher() {} '+
    'public function addEventListener(type:String, listener:Function):void {} } }\n');
  fs.writeFileSync(path.join(fakeSource,'Child.as'),
    'package { public class Child extends Base { private var button:FakeDispatcher; '+
    'public function Child(flag:Boolean) { this.button = new FakeDispatcher(); '+
    'this.button.addEventListener("click", this.onClick); super(flag ? 7 : 8); } '+
    'private function onClick():void { super.record("click"); } } }\n');
  run('python3',['-B','tools/create-fixture-profile.py','--source',fakeSource,'--entry','Application',
    '--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',fakeProfile]);
  const fakeOutput=path.join(dir,'fake-output');
  run(process.execPath,['bin/as3-frontend','qualify',fakeSource,fakeOutput,'--source-census',
    path.join(fakeProfile,'census.json'),'--target-capabilities',
    path.join(laya,'docTool/architecture/authored-content-capabilities.json'),
    '--profile-lock',path.join(fakeProfile,'profile-lock.json')]);
  const fakeRows=JSON.parse(fs.readFileSync(path.join(fakeOutput,'manifest.json'),'utf8')).files;
  assert.equal(fakeRows.find(row=>row.sourcePath==='Child.as').code,'HARDENED_SUPER_LOCAL_RECEIVER');

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
