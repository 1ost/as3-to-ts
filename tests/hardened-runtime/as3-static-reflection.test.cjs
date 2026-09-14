const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
test('sealed static reflection authority rejects spoofing and snapshots without class evaluation',t=>{
 const out=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'as3-static-reflection-')));t.after(()=>fs.rmSync(out,{recursive:true,force:true}));
 const config=path.join(out,'tsconfig.json');fs.writeFileSync(config,JSON.stringify({compilerOptions:{target:'ES2020',module:'commonjs',strict:true,skipLibCheck:true,types:[],outDir:path.join(out,'js')},files:[path.join(root,'src/hardened-runtime/AS3Reflection.ts')]}));
 cp.execFileSync(process.execPath,[path.join(root,'node_modules/typescript-4-9/bin/tsc'),'-p',config],{stdio:'inherit'});
 const registry=require(path.join(out,'js/internal/AS3TypeRegistry.js')),runtime=require(path.join(out,'js/AS3Reflection.js'));
 let constructed=0,reads=0,bound=0;
 class Original {constructor(){constructed++;}}
 Object.defineProperty(Original,'field',{get(){reads++;throw Error('field getter');}});
 const provider={createFlashReflectionMetadata(bindings){bound++;assert.equal(bindings[0].constructor,Original);return bindings[0].descriptor;},describeTypeXml(value,metadata){return metadata;}};
 assert.throws(()=>runtime.installAS3ReflectionProvider(provider),/sealed/);
 const row={kind:'class',qname:'example.Original',base:null,interfaces:[],sourceSha256:'a'.repeat(64),fields:[],staticReflection:{variables:[{name:'field',type:'String'}]}};
 const metadata={schema:'as3-runtime-type-authority@1',qnames:[row.qname],entries:[row]};
 registry.installAS3TypeAuthority({schema:metadata.schema,sha256:crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex'),qnames:metadata.qnames,entries:[{...row,constructor:Original,predicate:()=>false,constructionTarget:null,constructionProof:null}]});
 row.staticReflection.variables[0].name='changed';
 assert.throws(()=>runtime.as3DescribeTypeStatic(Original),/provider/);
 runtime.installAS3ReflectionProvider(provider);
 provider.describeTypeXml=()=>{throw Error('changed provider');};
 const first=runtime.as3DescribeTypeStatic(Original);
 assert.equal(first.qualifiedName,'example::Original');assert.equal(first.staticVariables[0].name,'field');assert.ok(Object.isFrozen(first.staticVariables[0]));
 assert.equal(runtime.as3DescribeTypeStatic(Original),first);assert.equal(bound,1);
 assert.throws(()=>runtime.as3DescribeTypeStatic(Object.create(Original.prototype)),/authority/);
 assert.throws(()=>runtime.as3DescribeTypeStatic(class Original {}),/authority/);
 assert.throws(()=>runtime.installAS3ReflectionProvider(provider),/already/);
 assert.equal(constructed,0);assert.equal(reads,0);
 for(const [variables,drift,pattern] of [
  [[{name:'a',type:'int'},{name:'a',type:'int'}],false,/duplicate/],
  [[{name:'a',type:''}],false,/Invalid/],
  [[{name:'a',type:'int'}],true,/SHA-256/]]) {
  for(const key of Object.keys(require.cache))if(key.startsWith(path.join(out,'js')+path.sep))delete require.cache[key];
  const fresh=require(path.join(out,'js/internal/AS3TypeRegistry.js'));
  const row2={...row,staticReflection:{variables}};
  const metadata2={schema:metadata.schema,qnames:metadata.qnames,entries:[row2]};
  const hash=crypto.createHash('sha256').update(JSON.stringify(metadata2)).digest('hex');
  if(drift)variables[0].name='tampered';
  assert.throws(()=>fresh.installAS3TypeAuthority({schema:metadata.schema,sha256:hash,qnames:metadata.qnames,entries:[{...row2,constructor:Original,predicate:()=>false,constructionTarget:null,constructionProof:null}]}),pattern);
  assert.throws(()=>fresh.getAS3StaticReflectionDescriptor(Original),/not sealed/);
 }

});
