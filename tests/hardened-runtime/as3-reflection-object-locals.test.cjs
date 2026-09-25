'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sha=v=>crypto.createHash('sha256').update(v).digest('hex');
test('native static-variable membership survives Object slots, calls, iteration and sealed static reads', {skip:!process.env.HARDENED_FIXTURE_LAYA},t=>{
 const laya=fs.realpathSync(process.env.HARDENED_FIXTURE_LAYA),fixture=path.join(laya,'tests/nativeFlashOracle/original-reflection');
 const proof=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json')));
 for(const [name,hash] of Object.entries(proof.sourceFiles))assert.equal(sha(fs.readFileSync(path.join(fixture,name))),hash,name);
 const original=fs.readFileSync(path.join(fixture,'mmo/ext/font/TextFormatLib.as'),'utf8');
 // Fixture extraction only. Production descriptors come from sealed compiler source authority.
 const variables=[...original.matchAll(/public static var ([A-Za-z_][A-Za-z_0-9]*):TextFormat = new TextFormat\(/g)].map(m=>({name:m[1],type:'flash.text::TextFormat'}));
 const native=proof.capture.state.observations.find(row=>row.id==='original-static-variables').result.rows;
 assert.equal(variables.length,370);
 const out=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'as3-reflection-object-')));let completed=false;t.after(()=>{if(completed)fs.rmSync(out,{recursive:true,force:true});else t.diagnostic(`Failed reflection artifacts retained: ${out}`);});
 const config=path.join(out,'tsconfig.json');fs.writeFileSync(config,JSON.stringify({compilerOptions:{target:'ES2021',lib:['ES2021','DOM'],module:'commonjs',strict:true,skipLibCheck:true,types:[],outDir:path.join(out,'js')},files:['AS3Reflection.ts','AS3ObjectDispatch.ts','AS3Enumeration.ts'].map(name=>path.join(root,'src/hardened-runtime',name))}));
 cp.execFileSync(process.execPath,[path.join(root,'node_modules/typescript-4-9/bin/tsc'),'-p',config],{stdio:'inherit'});
 const runtime=require(path.join(out,'js/AS3Reflection.js')),registry=require(path.join(out,'js/internal/AS3TypeRegistry.js'));
 const dispatch=require(path.join(out,'js/AS3ObjectDispatch.js')),enumeration=require(path.join(out,'js/AS3Enumeration.js')),coerce=require(path.join(out,'js/AS3Coerce.js')),initialization=require(path.join(out,'js/AS3ClassInitialization.js'));
 const providerFile=path.join(out,'provider.cjs');
 require('esbuild').buildSync({stdin:{contents:`export {createFlashReflectionMetadata} from ${JSON.stringify(path.join(laya,'src/layaAir/flash/utils/FlashReflectionMetadata.ts'))}; export {describeTypeXml} from ${JSON.stringify(path.join(laya,'src/layaAir/flash/utils/describeTypeXml.ts'))};`,resolveDir:root},bundle:true,platform:'node',format:'cjs',outfile:providerFile,logLevel:'silent'});
 const provider=require(providerFile),token={},getterToken={};let initialized=0,getterReads=0;
 class Formats{};class Getter{};
 const rows=[{kind:'class',qname:'mmo.ext.font.TextFormatLib',base:null,interfaces:[],sourceSha256:sha(original),fields:[],staticReflection:{variables},constructor:Formats,predicate:()=>false,constructionTarget:()=>null,constructionProof:v=>v===token},
 {kind:'class',qname:'test.Getter',base:null,interfaces:[],sourceSha256:'b'.repeat(64),fields:[],staticReflection:{variables:[{name:'field',type:'String'}]},constructor:Getter,predicate:()=>false,constructionTarget:()=>null,constructionProof:v=>v===getterToken}];
 const metadata={schema:'as3-runtime-type-authority@1',qnames:rows.map(r=>r.qname),entries:rows.map(({constructor,predicate,constructionTarget,constructionProof,...row})=>row)};
 registry.installAS3TypeAuthority({schema:metadata.schema,sha256:sha(JSON.stringify(metadata)),qnames:metadata.qnames,entries:rows});
 initialization.as3DefineClassInitialization(Formats,token,variables.map(v=>({name:v.name,value:null,readonly:false})),()=>{
  initialized++;
  // Synthetic values test dispatch identity only; this is not original TextFormat rendering parity.
  for(const variable of variables)initialization.as3InitializeStaticField(Formats,token,variable.name,Object.freeze({name:variable.name}));
 });
 Object.defineProperty(Getter,'field',{get(){getterReads++;throw Error('getter must not execute');}});
 runtime.installAS3ReflectionProvider(provider);
 const xml=runtime.as3DescribeTypeStatic(Formats),list=coerce.as3Object(dispatch.as3ObjectRead(xml,'variable'));
 assert.equal(initialized,0);
 const actual=[];
 for(const raw of enumeration.as3DynamicValues(list,'Object')){
  const node=coerce.as3Object(raw),attribute=coerce.as3Object(dispatch.as3ObjectCall(node,'attribute',['name']));
  const value=runtime.as3ReflectionStaticRead(Formats,attribute);
  actual.push([attribute.toPropertyKey(),'XMLList',attribute.length(),dispatch.as3ObjectCall(node,'attribute',['type']).toString()]);
  assert.equal(value.name,attribute.toPropertyKey());
 }
 assert.deepEqual(actual.sort((a,b)=>a[0].localeCompare(b[0])),native.map(row=>row.slice(0,4)).sort((a,b)=>a[0].localeCompare(b[0])));
 assert.equal(initialized,1);
 assert.equal(runtime.as3ReflectionStaticRead(Formats,variables[0].name).name,variables[0].name);
 assert.throws(()=>runtime.as3ReflectionStaticRead(Formats,'prototype'),/unproved/);
 assert.throws(()=>runtime.as3ReflectionStaticRead(Formats,{toPropertyKey(){throw Error('spoof invoked');}}),/static property key/);
 assert.throws(()=>runtime.as3ReflectionVariable({...xml}),/receiver/);
 assert.throws(()=>Array.from(runtime.as3ReflectionValues(Object.create(Object.getPrototypeOf(list)))),/receiver/);
 assert.throws(()=>runtime.as3ReflectionStaticRead(class Formats{},variables[0].name),/authority/);
 assert.throws(()=>runtime.as3ReflectionStaticRead(Getter,'field'),/data storage/);assert.equal(getterReads,0);
 assert.throws(()=>dispatch.as3ObjectRead(xml,'accessor'),/native evidence/);
 const node=Array.from(enumeration.as3DynamicValues(list,'Object'))[0];
 assert.throws(()=>dispatch.as3ObjectCall(node,'attribute',['missing']),/attribute selection/);
 assert.throws(()=>dispatch.as3ObjectCall(node,'attribute',[]),/native evidence/);
 assert.throws(()=>dispatch.as3ObjectWrite(node,'anything',1),error=>error instanceof dispatch.AS3ObjectDispatchUnavailable && error.message === 'Unregistered Object receiver identity');
 completed=true;
});
