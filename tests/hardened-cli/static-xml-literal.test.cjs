'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),laya=process.env.HARDENED_FIXTURE_LAYA,air=process.env.HARDENED_FIXTURE_AIR_SDK;
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';

test('static XML literal CLI uses the authenticated Laya provider in Node and Chromium',
 {skip:!laya||!air},async()=>{
 const base=path.join(root,'.cache/static-xml-literal');fs.mkdirSync(base,{recursive:true});
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(base,'run-'))),source=path.join(dir,'source'),profile=path.join(dir,'profile');
 fs.mkdirSync(source);
 const literal='<root>\n                <icon iconUrl="miniStar" iconType="uiSkin" iconStr=":]"/>\n            </root>';
 const stateLiteral='<root>\n                <icon iconUrl="state_print" iconType="uiSkin" iconStr=":}"/>\n            </root>';
 const input='package { public class Markup { public function markup():Object { var result:Object = '+literal+'; return result; } public function state():Object { return '+stateLiteral+'; } } }\n';
 const original=path.join(source,'Markup.as');fs.writeFileSync(original,input);const sourceHash=hash(input);
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(result.status,0,result.stdout+result.stderr);return result;};
 run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','Markup','--laya',laya,
  '--air-sdk',air,'--shared-static-xml','--output',profile]);
 const target=path.join(laya,'docTool/architecture/authored-content-capabilities.json');
 const args=out=>[source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),
  '--target-capabilities',target,'--profile-lock',path.join(profile,'profile-lock.json')];
 run(process.execPath,['bin/as3-frontend','transpile',...args('emitted')]);
 const emitted=path.join(dir,'emitted/__as3_runtime'),ts=fs.readFileSync(path.join(emitted,'application/Markup.ts'),'utf8');
 assert.match(ts,/as3XMLStaticLiteral as __as3XMLStaticLiteral/);
 assert.match(ts,/__as3XMLStaticLiteral\("<root>\\n/);
 assert.match(ts,/state_print/);
 const esbuild=require('esbuild');
 const entry=`import {startAS3Application} from ${JSON.stringify(path.join(emitted,'ApplicationEntry.generated.js'))}; const probe=startAS3Application(new AbortController().signal); globalThis.xmlLiteralResult={icon:probe.markup().toString(),state:probe.state().toString()};`;
 const bundle=(await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'js'},bundle:true,platform:'browser',format:'iife',target:'es2020',write:false,
  loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'},plugins:[{name:'shared-runtime',setup(build){
   build.onResolve({filter:/^laya\//},args=>({path:path.join(laya,'src/layaAir',args.path.slice(5)+'.ts')}));
   build.onResolve({filter:/^@laya\/as3-runtime\//},args=>({path:path.join(emitted,args.path.endsWith('/AS3Timer')?'AS3Timer.js':'AS3Authority.generated.js')}));
  }}]})).outputFiles[0].text;
 const observations=JSON.parse(fs.readFileSync(path.join(laya,'tests/nativeFlashOracle/static-xml-literal/native-air.json'),'utf8')).state.observations;
 const native={icon:observations[0].xml,state:observations[1].xml};
 const node=new Function(bundle+';return globalThis.xmlLiteralResult')();assert.deepEqual(node,native);
 const {chromium}=require(process.env.LAYA_PLAYWRIGHT_MODULE||path.join(laya,'node_modules/playwright'));
 const browser=await chromium.launch({headless:true});let web;
 try{const page=await browser.newPage();await page.addScriptTag({content:bundle});web=await page.evaluate(()=>globalThis.xmlLiteralResult);assert.deepEqual(web,native);}finally{await browser.close();}
 const lockFile=path.join(profile,'profile-lock.json'),originalLock=fs.readFileSync(lockFile,'utf8'),lock=JSON.parse(originalLock);
 delete lock.files.xmlStaticLiteralProvider;fs.writeFileSync(lockFile,canonical(lock)+'\n');
 run(process.execPath,['bin/as3-frontend','qualify',...args('without-provider')]);
 const held=JSON.parse(fs.readFileSync(path.join(dir,'without-provider/manifest.json'),'utf8')).files[0];
 assert.equal(held.status,'held');assert.equal(held.code,'HARDENED_EXPRESSION_UNSUPPORTED');
 fs.writeFileSync(lockFile,originalLock);
 assert.equal(hash(fs.readFileSync(original)),sourceHash);
 fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({status:'passed',realms:['Node','Chromium'],sourceUnchanged:true,providerRequired:true,xml:native},null,2)+'\n');
});
