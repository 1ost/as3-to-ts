'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),laya=process.env.HARDENED_FIXTURE_LAYA;
test('sealed class-name queries replay native primitives and ignore forged application fields',{skip:!laya},t=>{
 const output=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'as3-reflection-')));
 t.after(()=>fs.rmSync(output,{recursive:true,force:true}));
 for(const [base,files,sub] of [[path.join(root,'src'),['hardened-runtime/AS3Type.ts','hardened-runtime/AS3Coerce.ts'],'runtime'],[path.join(laya,'src/layaAir'),['flash/utils/getQualifiedClassName.ts'],'laya']]){
  const config=path.join(output,sub+'.json');fs.writeFileSync(config,JSON.stringify({compilerOptions:{target:'ES2022',module:'CommonJS',strict:true,skipLibCheck:true,rootDir:base,outDir:path.join(output,sub)},files:files.map(file=>path.join(base,file))}));
  cp.execFileSync(process.execPath,[path.join(root,'node_modules/typescript-4-9/bin/tsc'),'-p',config],{stdio:'inherit'});
 }
 const {resolveNativeClassName}=require(path.join(output,'laya/flash/utils/getQualifiedClassName.js'));
 const {as3ReflectionClassIdentity}=require(path.join(output,'runtime/hardened-runtime/AS3Type.js'));
 const {as3Number}=require(path.join(output,'runtime/hardened-runtime/AS3Coerce.js'));
 const {as3BindMethod}=require(path.join(output,'runtime/hardened-runtime/AS3MethodClosure.js'));
 const registry=require(path.join(output,'runtime/hardened-runtime/internal/AS3TypeRegistry.js'));
 class Original {}
 const value=new Original(),identities=new WeakSet([value]);
 assert.throws(()=>as3ReflectionClassIdentity(value),/authority/);
 const row={kind:'class',qname:'example.Original',base:null,interfaces:[],sourceSha256:'a'.repeat(64),fields:[],objectTraits:{dynamic:false,members:[]}};
 const metadata={schema:'as3-runtime-type-authority@1',qnames:[row.qname],entries:[row]};
 registry.installAS3TypeAuthority({schema:metadata.schema,sha256:crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex'),qnames:metadata.qnames,entries:[{...row,constructor:Original,predicate:v=>identities.has(v),constructionTarget:null,constructionProof:null}]});
 const query=value=>resolveNativeClassName(value,as3ReflectionClassIdentity);
 const dir=path.join(laya,'tests/nativeFlashOracle/qualified-class'),golden=JSON.parse(fs.readFileSync(path.join(dir,'native-air.json'),'utf8')),scenario=JSON.parse(fs.readFileSync(path.join(dir,'scenario.json'),'utf8'));
 for(const [file,key] of [['QualifiedClassProbe.as','sourceSha256'],['scenario.json','scenarioSha256']])assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,file))).digest('hex'),golden[key]);
 let replayed=0;
 for(const checkpoint of golden.capture.state.observations){
  const call=scenario.steps.find(step=>step.id===checkpoint.id).calls[0];
  if(!['inspect','numeric'].includes(call.method))continue;
  assert.equal(query(call.method==='numeric'?as3Number(call.args[0]):call.args[0]),checkpoint.result,checkpoint.id);replayed++;
 }
 assert.equal(replayed,50);
 for(const input of [Original,value])assert.equal(query(input),'example::Original');
 Object.defineProperty(value,'constructor',{get(){throw new Error('must not observe constructor');}});
 Object.defineProperty(value,'__className',{get(){throw new Error('must not observe class name');}});
 assert.equal(query(value),'example::Original');
 assert.equal(query({constructor:Original,__className:'Forged'}),'Object');
 assert.equal(query(as3BindMethod(value,()=>{})),'builtin.as$0::MethodClosure');
 assert.equal(query(()=>{}),'Function');
 for(const input of [1n,Symbol(),new(class Unknown{})(),Object.create(Original.prototype)])assert.throws(()=>query(input),TypeError);
 assert.equal(resolveNativeClassName(value,()=> 'domain.Other'),'domain::Other');
 assert.equal(query(value),'example::Original');
});
