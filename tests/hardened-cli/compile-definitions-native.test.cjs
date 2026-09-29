const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const canonical=x=>x===null||typeof x!=='object'?JSON.stringify(x):Array.isArray(x)?'['+x.map(canonical).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
test('native AIR Boolean compile definitions match unchanged generated source; authority mismatches fail',async()=>{
 const sdk=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA;
 assert(sdk&&laya&&process.env.HARDENED_FIXTURE_FFDEC,'AIR SDK, Laya and FFDec required');
 const base=path.join(root,'.cache/compile-definitions');fs.mkdirSync(base,{recursive:true});const dir=fs.realpathSync(fs.mkdtempSync(path.join(base,'run-')));
 const source=path.join(__dirname,'fixtures/compile-definitions'),sourceFile=path.join(source,'CompileDefinitionsProbe.as'),sourceHash=sha(fs.readFileSync(sourceFile));
 const host=path.join(dir,'NativeMain.as');fs.writeFileSync(host,'package {import flash.display.Sprite;import flash.desktop.NativeApplication;import flash.system.Capabilities;public class NativeMain extends Sprite{public function NativeMain(){var p:CompileDefinitionsProbe=new CompileDefinitionsProbe();var before:String=p.value;trace("CONFIG_CAPTURE:"+JSON.stringify({runtime:Capabilities.version,values:[before,p.run(),p.run()]}));NativeApplication.nativeApplication.exit();}}}');
 const run=(cmd,args,ok=true)=>{const r=cp.spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:180000});if(ok)assert.equal(r.status,0,r.stdout+r.stderr);return r;};
 const results=[];
 for(const [enabled,nested] of [[true,true],[true,false],[false,true]]){
  const label=String(enabled)+'-'+String(nested),out=path.join(dir,label);fs.mkdirSync(out);
  const config={schema:'as3-boolean-compile-definitions@1',definitions:{'CONFIG::enabled':enabled,'CONFIG::nested':nested,'CONFIG::disabled':false}};
  const configFile=path.join(out,'definitions.json');fs.writeFileSync(configFile,canonical(config)+'\n');
  const flags=Object.entries(config.definitions).map(([key,value])=>'-define+='+key+','+value);
  const swf=path.join(out,'native.swf'),compiler=path.join(sdk,'bin/amxmlc');
  const compileArgs=['-debug=true','-source-path+='+source,...flags,'-output='+swf,host];
  const compiled=run(compiler,compileArgs);fs.writeFileSync(path.join(out,'compile.log'),compiled.stdout+compiled.stderr);
  const app=path.join(out,'application.xml');fs.writeFileSync(app,'<application xmlns="http://ns.adobe.com/air/application/51.1"><id>as3.compile.definitions</id><versionNumber>1.0.0</versionNumber><filename>NativeMain</filename><initialWindow><content>native.swf</content><visible>false</visible></initialWindow></application>');
  const native=[];for(let i=0;i<2;i++){const capture=run(path.join(sdk,'bin/adl'),['-nodebug',app]);fs.writeFileSync(path.join(out,'native-'+i+'.log'),capture.stdout+capture.stderr);const line=(capture.stdout+capture.stderr).split(/\r?\n/).find(x=>x.startsWith('CONFIG_CAPTURE:'));assert(line,capture.stdout+capture.stderr);native.push(JSON.parse(line.slice('CONFIG_CAPTURE:'.length)));}
  assert.deepEqual(native[0],native[1]);assert.equal(native[0].runtime,'MAC 51,3,3,2');
  const profile=path.join(out,'profile');run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','CompileDefinitionsProbe','--air-sdk',sdk,'--laya',laya,'--ffdec-jar',process.env.HARDENED_FIXTURE_FFDEC,'--compile-definitions',configFile,'--output',profile]);
  const lock=path.join(profile,'profile-lock.json'),args=dest=>['bin/as3-frontend','transpile',source,path.join(out,dest),'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',lock];
  run(process.execPath,args('emitted'));const entry=path.join(out,'emitted/__as3_runtime/ApplicationEntry.generated.js');
  const bundle=(await require('esbuild').build({stdin:{contents:`import {startAS3Application} from ${JSON.stringify(entry)}; const p=startAS3Application(new AbortController().signal); globalThis.configResult=[p.value,p.run(),p.run()];`,resolveDir:root,loader:'js'},bundle:true,write:false,platform:'browser',format:'iife',target:'es2020',plugins:[{name:'laya',setup(b){b.onResolve({filter:/^laya\//},a=>({path:path.join(laya,'src/layaAir',a.path.slice(5)+'.ts')}));}}],loader:{'.glsl':'text','.fs':'text','.vs':'text','.wgsl':'text'}})).outputFiles[0].text;
  fs.writeFileSync(path.join(out,'bundle.js'),bundle);const values=new Function(bundle+';return globalThis.configResult;')();assert.deepEqual(values,native[0].values);
  const {chromium}=require(process.env.LAYA_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({headless:true});let web;try{const page=await browser.newPage();await page.addScriptTag({content:bundle});web=await page.evaluate(()=>globalThis.configResult);assert.deepEqual(web,native[0].values);}finally{await browser.close();}
  // Both local declarations and parsing must be bound to the same flags.
  const originalLock=fs.readFileSync(lock),lockDoc=JSON.parse(originalLock),definitionPath=path.join(profile,lockDoc.files.compileDefinitions.path),originalConfig=fs.readFileSync(definitionPath);
  const forged=JSON.parse(originalConfig);forged.definitions['CONFIG::enabled']=!enabled;fs.writeFileSync(definitionPath,canonical(forged)+'\n');
  const badFile=run(process.execPath,args('bad-file'),false);assert.notEqual(badFile.status,0);assert.match(badFile.stderr,/hash|digest|SHA|match/i);
  lockDoc.files.compileDefinitions.sha256=sha(fs.readFileSync(definitionPath));fs.writeFileSync(lock,canonical(lockDoc)+'\n');
  const badMap=run(process.execPath,args('bad-map'),false);assert.notEqual(badMap.status,0);assert.match(badMap.stderr,/local member authority|LOCAL_MEMBER_SCHEMA/i);
  fs.writeFileSync(definitionPath,originalConfig);fs.writeFileSync(lock,originalLock);
  results.push({enabled,nested,native:native[0],node:values,web,sourceSha256:sourceHash,compilerCommand:[compiler,...compileArgs],swfSha256:sha(fs.readFileSync(swf))});
 }
 const included=run(path.join(sdk,'bin/amxmlc'),['-debug=true','-source-path+='+source,'-define+=CONFIG::enabled,true','-define+=CONFIG::nested,true','-define+=CONFIG::disabled,true','-output='+path.join(dir,'must-fail.swf'),host],false);
 assert.notEqual(included.status,0);assert.match(included.stdout+included.stderr,/MissingInstrumentation/);fs.writeFileSync(path.join(dir,'enabled-missing-type.log'),included.stdout+included.stderr);
 const missingNested=run(path.join(sdk,'bin/amxmlc'),['-debug=true','-source-path+='+source,'-define+=CONFIG::enabled,false','-define+=CONFIG::disabled,false','-output='+path.join(dir,'missing-nested.swf'),host],false);
 assert.notEqual(missingNested.status,0);assert.match(missingNested.stdout+missingNested.stderr,/Can not resolve config constant: 'nested'/);fs.writeFileSync(path.join(dir,'missing-nested.log'),missingNested.stdout+missingNested.stderr);
 assert.equal(sha(fs.readFileSync(sourceFile)),sourceHash);fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({status:'passed',results,sourceUnchanged:true,negativeControls:8},null,2)+'\n');console.log(JSON.stringify({dir,status:'passed',nativeConfigurations:results.length,realms:['AIR','Node','Chromium']}));
});
