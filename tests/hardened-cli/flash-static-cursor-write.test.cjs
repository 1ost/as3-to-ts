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

test('double-pinned Flash static cursor writes reach the canonical browser Mouse bridge',
 {skip:!laya||!air||!ffdec||!playwright},async t=>{
  const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'flash-static-cursor-write-')));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const source=path.join(dir,'source'),profile=path.join(dir,'profile'),output=path.join(dir,'output');
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source,'Application.as'),
    'package { import flash.ui.Mouse; import flash.ui.MouseCursor; '+
    'public class Application { public function Application() { Mouse.cursor = MouseCursor.BUTTON; } '+
    'public function reset():void { Mouse.cursor = MouseCursor.AUTO; } } }\n');
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
  assert.equal(rows.length,1);
  assert.ok(rows[0].typescriptSha256,JSON.stringify(rows[0]));
  const readonlySource=path.join(dir,'readonly-source'),readonlyProfile=path.join(dir,'readonly-profile');
  fs.mkdirSync(readonlySource);
  fs.writeFileSync(path.join(readonlySource,'BadWrite.as'),
    'package { import flash.ui.Mouse; public class BadWrite { '+
    'public function BadWrite() { Mouse.supportsCursor = true; } } }\n');
  run('python3',['-B','tools/create-fixture-profile.py','--source',readonlySource,'--entry','BadWrite',
    '--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',readonlyProfile]);
  const readonlyOutput=path.join(dir,'readonly-output');
  run(process.execPath,['bin/as3-frontend','qualify',readonlySource,readonlyOutput,'--source-census',
    path.join(readonlyProfile,'census.json'),'--target-capabilities',
    path.join(laya,'docTool/architecture/authored-content-capabilities.json'),
    '--profile-lock',path.join(readonlyProfile,'profile-lock.json')]);
  const readonlyRows=JSON.parse(fs.readFileSync(path.join(readonlyOutput,'manifest.json'),'utf8')).files;
  assert.equal(readonlyRows[0].code,'HARDENED_STATIC_MEMBER');
  const runtime=path.join(output,'__as3_runtime');
  const layaSource=path.join(laya,'src/layaAir');
  const bootstrap=['laya/ModuleDef','laya/ui/ModuleDef','laya/platform/BrowserAdapter',
    'laya/platform/FileSystemAdapter','laya/platform/FontAdapter','laya/platform/MediaAdapter',
    'laya/platform/StorageAdapter','laya/platform/TextInputAdapter','laya/device/WebDeviceAdapter',
    'laya/RenderDriver/RenderModuleData/WebModuleData/WebUnitRenderModuleDataFactory',
    'laya/RenderDriver/WebGLDriver/RenderDevice/WebGLRenderDeviceFactory',
    'laya/RenderDriver/WebGLDriver/2DRenderPass/WebGLRender2DProcess']
    .map(name=>`import ${JSON.stringify(path.join(layaSource,name+'.ts'))};`).join('\n');
  const entry=bootstrap+`\nimport {Laya} from ${JSON.stringify(path.join(layaSource,'Laya.ts'))};
import {Mouse} from ${JSON.stringify(path.join(layaSource,'flash/ui/Mouse.ts'))};
import {startAS3Application} from ${JSON.stringify(path.join(runtime,'ApplicationEntry.generated.js'))};
globalThis.completion=Laya.init(800,600).then(()=>{
 const app=startAS3Application(new AbortController().signal);
 globalThis.before=[Mouse.cursor,document.body.style.cursor];
 app.reset();
 globalThis.after=[Mouse.cursor,document.body.style.cursor];
});`;
  const built=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'js'},
    bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',
    loader:{'.glsl':'text','.fs':'text','.vs':'text','.wgsl':'text'},
    alias:{'laya/flash':path.join(layaSource,'flash')}});
  const {chromium}=require(playwright);
  const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=swiftshader']});
  try{
    const page=await browser.newPage();
    await page.route('http://flash-static-cursor.test/**',route=>route.request().url().endsWith('/bundle.js')
      ? route.fulfill({contentType:'text/javascript',body:built.outputFiles[0].text})
      : route.fulfill({contentType:'text/html',body:'<!doctype html><body><script src="/bundle.js"></script>'}));
    await page.goto('http://flash-static-cursor.test/');
    await page.evaluate(()=>globalThis.completion);
    assert.deepEqual(await page.evaluate(()=>[globalThis.before,globalThis.after]),
      [['button','pointer'],['auto','auto']]);
  }finally{await browser.close();}
});
