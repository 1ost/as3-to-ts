"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),
 os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'as3-final-class-'));
fs.writeFileSync(path.join(out,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'CommonJS',strict:true,skipLibCheck:true,rootDir:path.join(root,'src'),outDir:out},files:[path.join(root,'src/hardened-runtime/internal/AS3TypeRegistry.ts')]}));
cp.execFileSync(process.execPath,[path.join(root,'node_modules/typescript-4-9/bin/tsc'),'-p',path.join(out,'tsconfig.json')],{stdio:'inherit'});
test.after(()=>fs.rmSync(out,{recursive:true,force:true}));
const modulePath=path.join(out,'hardened-runtime/internal/AS3TypeRegistry.js');
const script=`const assert=require('node:assert/strict'),crypto=require('node:crypto'),r=require(process.argv[1]);
const mode=process.argv[2];class Base {} class Child extends Base {} class Foreign extends Base {}
const final=mode==='nonfinal'?{}:mode==='false-flag'?{final:false}:{final:true};
const rows=[{kind:'class',qname:'Base',base:null,interfaces:[],sourceSha256:'a'.repeat(64),fields:[],objectTraits:{dynamic:false,...final,members:[]}}];
if(mode==='child'||mode==='nonfinal')rows.push({kind:'class',qname:'Child',base:'Base',interfaces:[],sourceSha256:'b'.repeat(64),fields:[],objectTraits:{dynamic:false,members:[]}});
const metadata={schema:'as3-runtime-type-authority@1',qnames:rows.map(x=>x.qname),entries:rows};
const document={schema:metadata.schema,sha256:crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex'),qnames:metadata.qnames,entries:rows.map((row,i)=>({...row,constructor:i?Child:Base,predicate:v=>i?v instanceof Child:v instanceof Base,constructionTarget:null,constructionProof:null}))};
if(mode==='child'){assert.throws(()=>r.installAS3TypeAuthority(document),/cannot extend final class Base/);assert.throws(()=>r.canConstructAs(Base,Base));}
else if(mode==='false-flag')assert.throws(()=>r.installAS3TypeAuthority(document),/Object traits/);
else {r.installAS3TypeAuthority(document);assert.equal(r.canConstructAs(Base,Base),true);assert.equal(r.canConstructAs(Foreign,Base),false);
 const traits=r.lookupObjectClass(new Base()).chain[0].traits;assert.equal(traits.final,mode==='nonfinal'?undefined:true);assert.ok(Object.isFrozen(traits));
 if(mode==='nonfinal')assert.equal(r.canConstructAs(Child,Base),true);}`;
for(const mode of ['final','child','nonfinal','false-flag'])test('final class registry: '+mode,()=>{
 const result=cp.spawnSync(process.execPath,['-e',script,modulePath,mode],{encoding:'utf8'});assert.equal(result.status,0,result.stdout+result.stderr);
});
