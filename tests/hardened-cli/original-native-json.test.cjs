const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),laya=process.env.HARDENED_FIXTURE_LAYA;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('Original NativeJson source executes through shared TypeError and JSON definition providers',async()=>{
 assert.ok(laya&&process.env.HARDENED_FIXTURE_AIR_SDK&&process.env.HARDENED_FIXTURE_FFDEC,'AIR, Laya and FFDec required');
 const evidence=path.join(laya,'tests/nativeFlashOracle/original-native-json'),read=name=>fs.readFileSync(path.join(evidence,name));
 for(const [file,expected] of Object.entries(JSON.parse(read('evidence-pin.json'))))assert.equal(hash(read(file)),expected);
 const receipt=JSON.parse(read('native-receipt.json')),captured=JSON.parse(read('native-capture.json'));
 assert.equal(receipt.status,'passed');assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.identical,true);
 assert.equal(receipt.capture.observationCount,10);assert.equal(captured.runtime.version,'MAC 51,3,3,2');
 assert.equal(hash(read('OriginalNativeJsonProbe.as')),receipt.artifacts['source/OriginalNativeJsonProbe.as']);
 assert.equal(hash(read('scenario.json')),receipt.scenario.sha256);
 assert.equal(hash(read('OracleHost.retained.as.txt')),receipt.artifacts['host/OracleHost.as']);
 for(const run of [1,2])assert.equal(hash(read('native-capture.json')),receipt.artifacts[`run-${run}/capture.json`]);
 const base=path.join(root,'.cache/original-native-json');fs.mkdirSync(base,{recursive:true});
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(base,'run-'))),profile=path.join(dir,'profile');
 const run=(cmd,args)=>{const r=cp.spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);return r;};
 const source=path.join(dir,'source');fs.mkdirSync(source);for(const file of ['OriginalNativeJsonProbe.as','util/json/NativeJson.as']){fs.mkdirSync(path.dirname(path.join(source,file)),{recursive:true});fs.writeFileSync(path.join(source,file),read(file));assert.equal(hash(read(file)),receipt.artifacts['source/'+file]);}
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','OriginalNativeJsonProbe',
  '--air-sdk',process.env.HARDENED_FIXTURE_AIR_SDK,'--laya',laya,'--ffdec-jar',process.env.HARDENED_FIXTURE_FFDEC,'--shared-type-error','--shared-json-definition','--output',profile]);
 const args=out=>[source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),
  '--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')];
 make();run(process.execPath,['bin/as3-frontend','transpile',...args('emitted')]);
 const emittedProbe=fs.readFileSync(path.join(dir,'emitted/__as3_runtime/application/util/json/NativeJson.ts'),'utf8');assert.match(emittedProbe,/laya\/flash\/utils\/AS3TypeError/);assert.match(emittedProbe,/__as3SourceTypeError/);assert.doesNotMatch(emittedProbe,/new TypeError\(/);
 const output=path.join(dir,'emitted/__as3_runtime'),steps=JSON.parse(read('scenario.json')).steps,wanted=captured.state.observations;
 const esbuild=require('esbuild'),entry=`import {startAS3Application} from ${JSON.stringify(path.join(output,'ApplicationEntry.generated.js'))};
const probe=startAS3Application(new AbortController().signal);
globalThis.typeErrorProvider=${JSON.stringify(steps)}.map(step=>{for(const call of step.calls)probe[call.method](...call.args);return {id:step.id,result:probe.result};});`;
 const definitionEvidence=path.join(laya,'tests/nativeFlashOracle/json-definition-bridge');
 for(const [file,digest] of Object.entries(JSON.parse(fs.readFileSync(path.join(definitionEvidence,'evidence-pin.json')))))assert.equal(hash(fs.readFileSync(path.join(definitionEvidence,file))),digest);
 const definitionNative=JSON.parse(fs.readFileSync(path.join(definitionEvidence,'native-capture.json'))).state.observations;
 const definitionSteps=JSON.parse(fs.readFileSync(path.join(definitionEvidence,'scenario.json'))).steps;
 const definitionDriver=`
import {getDefinitionByName} from "laya/flash/utils/DefinitionRegistry";
import {isSourceJSONDefinition,callSourceJSONDefinition} from "laya/flash/utils/AS3JSONDefinition";
import {as3ObjectCall} from ${JSON.stringify(path.join(output,'AS3Authority.generated.js'))};
import {as3FunctionArgument} from ${JSON.stringify(path.join(output,'AS3Authority.generated.js'))};
const definition=getDefinitionByName("JSON");
globalThis.jsonDefinitionRows=${JSON.stringify(definitionSteps)}.map(step=>{
 const [mode,text]=step.calls[0].args;
 const args=[[text],[],[text,null],[text,null,0],[null],[undefined],[42],[true],[{toString(){return "[1,2]";}}]][mode];
 let result;try{result=["returned",as3ObjectCall(definition,"parse",args),definition===getDefinitionByName("JSON"),isSourceJSONDefinition(definition)];}
 catch(error){result=["threw",error.name,error.message,error.errorID];}
 return {id:step.id,result};
});
const guards=[];const reject=(name,run)=>{let caught=false;try{run();}catch{caught=true;}guards.push({name,ok:caught});};
const convert=value=>as3FunctionArgument(value,"String");
reject("forged definition",()=>callSourceJSONDefinition(function JSON(){},"parse",["{}"],convert));
for(const name of ["stringify","parseCore","prototype","__proto__"])reject(name,()=>callSourceJSONDefinition(definition,name,["{}"],convert));
reject("unqualified reviver",()=>callSourceJSONDefinition(definition,"parse",["{}",()=>{}],convert));
reject("sparse arguments",()=>callSourceJSONDefinition(definition,"parse",new Array(1),convert));
let read=0;const accessor=[];Object.defineProperty(accessor,"0",{get(){read++;return "{}";}});
reject("argument accessor",()=>callSourceJSONDefinition(definition,"parse",accessor,convert));guards.push({name:"accessor not invoked",ok:read===0});
globalThis.jsonDefinitionGuards=guards;
`;
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'emitted/manifest.json')));
 assert.equal(manifest.files.length,2);for(const row of manifest.files)assert.ok(row.typescriptPath,JSON.stringify(row));
 const files=manifest.files.map(row=>path.join(dir,'emitted',row.typescriptPath));
 const typeConfig=path.join(dir,'generated-tsconfig.json');
 fs.writeFileSync(typeConfig,JSON.stringify({compilerOptions:{target:'ES2020',module:'CommonJS',moduleResolution:'node',strict:true,strictNullChecks:true,strictPropertyInitialization:true,experimentalDecorators:true,resolveJsonModule:true,allowSyntheticDefaultImports:true,skipLibCheck:true,noEmit:true,types:[],lib:['ES2020','DOM','DOM.Iterable'],baseUrl:root,paths:{'@laya/as3-runtime/*':['src/hardened-runtime/*'],'laya/*':[path.join(laya,'src/layaAir/*')]}},files:[...files,path.join(laya,'src/layaAir/tslibs/glsl.d.ts'),path.join(laya,'src/layaAir/tslibs/spine.d.ts')]}));
 run(process.execPath,[path.join(root,'node_modules/typescript-4-9/bin/tsc'),'-p',typeConfig,'--pretty','false']);
 const built=await esbuild.build({plugins:[{name:'shared-laya',setup(build){build.onResolve({filter:/^laya\//},args=>({path:path.join(laya,'src/layaAir',args.path.slice(5)+'.ts')}));}}],stdin:{contents:entry+definitionDriver,resolveDir:root,loader:'js'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}});
 const bundle=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),bundle);
 const execution=new Function(bundle+';return {app:globalThis.typeErrorProvider,definition:globalThis.jsonDefinitionRows,guards:globalThis.jsonDefinitionGuards};')();
 const node=JSON.parse(JSON.stringify(execution.app));const nativeCalls=JSON.parse(JSON.stringify(execution.definition));assert.deepEqual(nativeCalls,definitionNative);assert.ok(execution.guards.every(row=>row.ok));
 const {chromium}=require(process.env.LAYA_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({headless:true});
 let web,webDefinitions,webGuards;try{const page=await browser.newPage({timezoneId:'Europe/Rome'});await page.addScriptTag({content:bundle});web=JSON.parse(await page.evaluate(()=>JSON.stringify(globalThis.typeErrorProvider)));webDefinitions=JSON.parse(await page.evaluate(()=>JSON.stringify(globalThis.jsonDefinitionRows)));webGuards=await page.evaluate(()=>globalThis.jsonDefinitionGuards);assert.deepEqual(webDefinitions,definitionNative);assert.ok(webGuards.every(row=>row.ok));}finally{await browser.close();}
 assert.equal(hash(fs.readFileSync(path.join(source,'util/json/NativeJson.as'))),hash(read('util/json/NativeJson.as')));
 fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({status:require("node:util").isDeepStrictEqual(node,wanted)?"matched":"mismatch",rows:10,sharedProviderRows:19,sharedProviderGuards:execution.guards,nativeCalls,webDefinitions,native:wanted,node,web,sourceUnchanged:true,applicationStart:true,originalClass:'util.json.NativeJson',typecheck:{strict:true,strictNullChecks:true,diagnostics:0}},null,2)+'\n');
 console.log(JSON.stringify({dir,rows:10,realms:['Node','Chromium'],report:'report.json'}));
 assert.deepEqual(node,wanted);assert.deepEqual(web,wanted);
 const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
 const lockPath=path.join(profile,'profile-lock.json'),savedLock=fs.readFileSync(lockPath),lock=JSON.parse(savedLock);
 const proofPath=path.join(profile,lock.files.jsonDefinitionProvider.path),savedProof=fs.readFileSync(proofPath);
 for(const [name,mutate] of [
  ['changed-target',proof=>{proof.target.targetSources['src/layaAir/flash/utils/AS3JSONDefinition.ts']='0'.repeat(64);} ],
  ['changed-sdk-declaration',proof=>{proof.declaration=proof.declaration.replace('text:String','text:Object');}],
  ['foreign-sdk',proof=>{proof.sourceArtifactSha256='0'.repeat(64);}]
 ]) {try {
  const proof=JSON.parse(savedProof);mutate(proof);fs.writeFileSync(proofPath,canonical(proof)+'\n');
  const altered=JSON.parse(savedLock);altered.files.jsonDefinitionProvider.sha256=hash(fs.readFileSync(proofPath));fs.writeFileSync(lockPath,canonical(altered)+'\n');
  const result=cp.spawnSync(process.execPath,['bin/as3-frontend','qualify',...args(name)],{cwd:root,encoding:'utf8',timeout:120000});assert.equal(result.status,6);assert.match(result.stderr,/JSON definition provider/);
 } finally {fs.writeFileSync(proofPath,savedProof);fs.writeFileSync(lockPath,savedLock);} }

});
