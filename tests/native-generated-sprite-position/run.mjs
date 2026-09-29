import {execFileSync} from 'node:child_process';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {buildGeneratedSpritePosition} from './build.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),compiler=path.resolve(here,'../..'),engine=path.resolve(compiler,'../LayaAir-op2'),op2=path.resolve(compiler,'../op2-html5'),require=createRequire(import.meta.url);
const {build}=require(path.join(engine,'node_modules/esbuild')),{chromium}=require(require.resolve('playwright',{paths:[path.join(op2,'game-client-laya')]}));
const {createLayaSourceAliasPlugin}=await import(path.join(op2,'game-client-laya/tests/support/laya-source-alias.mjs').replaceAll('\\','/').replace(/^([A-Za-z]):/,'file:///$1:'));
execFileSync(process.execPath,[path.join(compiler,'node_modules/typescript/lib/tsc.js'),'--project',path.join(compiler,'tsconfig.json')],{cwd:compiler,stdio:'pipe'});
const expected=require(path.join(engine,'tests/nativeFlashOracle/generated-sprite-position-overrides/verify.cjs'));
const sha=b=>createHash('sha256').update(b).digest('hex'),results=[];
for(const target of ['ES5','ES2015']){
 const built=buildGeneratedSpritePosition(target),result={target,out:built.out};results.push(result);
 try{
 assert.equal(built.report.factoryHold,undefined);assert.deepEqual(built.report.diagnostics,[]);
 const observer=fs.readFileSync(path.join(here,'observer.ts'),'utf8').replaceAll('@FLASH@',path.join(engine,'src/layaAir/flash').replaceAll('\\','/')).replace('@RENDERER@',path.join(op2,'game-client-laya/tests/net-module/renderer').replaceAll('\\','/'));
 const entry=path.join(built.out,'observer.ts');fs.writeFileSync(entry,observer);
 const bundled=await build({entryPoints:[entry],bundle:true,write:false,format:'iife',globalName:'PositionProbe',platform:'browser',target:'es2022',metafile:true,plugins:[createLayaSourceAliasPlugin(engine)],loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}});
 const mutations=['missing-contract','missing-override','wrong-type','wrong-half','wrong-base','accessor-getter','final-parent'];
 const mutationBundles=[];
 for(const mutation of mutations){
  let count=0;const altered=await build({entryPoints:[entry],bundle:true,write:false,format:'iife',globalName:'PositionProbe',platform:'browser',target:'es2022',plugins:[{name:'mutation',setup(b){b.onLoad({filter:/sprite-position\.js$/},args=>{
   let contents=fs.readFileSync(args.path,'utf8');
   if(mutation==='wrong-base'){contents=contents.replace(/nativeAccessorBase:\s*[^,]+,/g,()=>{count++;return 'nativeAccessorBase:Object,';});}
   else contents=contents.replace(/instanceAccessors:\s*(\[[^\n]*?\]),\s*instanceMethods:/g,(whole,json)=>{
    count++;const contracts=JSON.parse(json);
    if(mutation==='missing-contract')return 'instanceMethods:';
    if(mutation==='accessor-getter')return 'get instanceAccessors(){throw Error("contract getter executed");},instanceMethods:';
    for(const c of contracts){if(mutation==='wrong-type')c.type='String';if(mutation==='wrong-half'&&c.set&&!c.get)c.get=c.set;for(const side of ['get','set'])if(c[side]){if(mutation==='missing-override')c[side].override=false;if(mutation==='final-parent')c[side].final=true;}}
    return 'instanceAccessors:'+JSON.stringify(contracts)+',instanceMethods:';
   });return {contents,loader:'js'};
  });}},createLayaSourceAliasPlugin(engine)],loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}});assert.ok(count,mutation);mutationBundles.push({mutation,code:altered.outputFiles[0].text});
 }
 const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://position.test/**',r=>r.request().url().endsWith('fixture.js')?r.fulfill({contentType:'text/javascript',body:bundled.outputFiles[0].text}):r.fulfill({contentType:'text/html',body:'<!doctype html><script src="/fixture.js"></script>'}));
 await page.goto('http://position.test/');assert.deepEqual(errors,[]);result.observation=await page.evaluate(()=>PositionProbe.run());assert.deepEqual(errors,[]);assert.deepEqual(result.observation.rows,expected);assert.equal(result.observation.guards.length,5);result.status='passed';result.mutations=[];
 for(const {mutation,code} of mutationBundles){const negative=await browser.newPage();try{await negative.route('http://position.test/**',r=>r.fulfill({contentType:r.request().url().endsWith('fixture.js')?'text/javascript':'text/html',body:r.request().url().endsWith('fixture.js')?code:'<!doctype html><script src="/fixture.js"></script>'}));await negative.goto('http://position.test/');await assert.rejects(()=>negative.evaluate(()=>PositionProbe.run()),/AS3_GENERATED_CLASS_UNSUPPORTED/,mutation);result.mutations.push(mutation);}finally{await negative.close();}}

 }finally{await browser.close();}
 result.review=built.report;result.inputs=Object.keys(bundled.metafile.inputs).map(file=>({file,sha256:sha(fs.readFileSync(file))}));
 }catch(error){result.status='failed';result.error=String(error.stack||error);}
 for(const item of [...(result.inputs||[]),...built.report.compilerInputs,...built.report.typeInputs,...built.report.outputs,...built.report.sources])assert.equal(sha(fs.readFileSync(item.file)),item.sha256,item.file);
 fs.writeFileSync(path.join(built.out,'runtime.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result.status==='passed'?{target,out:built.out,status:'passed',rows:result.observation.rows.length}:result));
}
if(results.some(r=>r.status!=='passed'))process.exitCode=1;
