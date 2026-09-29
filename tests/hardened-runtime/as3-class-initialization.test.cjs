'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),output=fs.mkdtempSync(path.join(os.tmpdir(),'as3-class-initialization-'));
fs.writeFileSync(path.join(output,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'CommonJS',strict:true,skipLibCheck:true,rootDir:path.join(root,'src'),outDir:output},files:[path.join(root,'src/hardened-runtime/AS3ClassInitialization.ts')]}));
cp.execFileSync(process.execPath,[path.join(root,'node_modules/typescript-4-9/bin/tsc'),'-p',path.join(output,'tsconfig.json')],{stdio:'inherit'});
const runtime=require(path.join(output,'hardened-runtime/AS3ClassInitialization.js'));
const registry=require(path.join(output,'hardened-runtime/internal/AS3TypeRegistry.js'));
test.after(()=>fs.rmSync(output,{recursive:true,force:true}));
test('definition registration cannot execute source before sealed authority or forge an initializer owner',()=>{
 class Base {static value=0;} class Child extends Base {static child=0;} class Foreign {}
 const baseProof={},childProof={},events=[];
 const {as3DefineClassInitialization:define,as3InitializeClass:initialize,as3InitializeStaticField:field}=runtime;
 define(Base,baseProof,[{name:'value',value:0,readonly:true}],()=>{events.push('base');field(Base,baseProof,'value',11);});
 define(Child,childProof,[{name:'child',value:0,readonly:false}],()=>{events.push('child');field(Child,childProof,'child',Base.value+1);});
 assert.deepEqual(events,[]);assert.equal(Base.value,0);
 assert.throws(()=>initialize(Child),/authority is not sealed/);assert.deepEqual(events,[]);
 assert.throws(()=>define(Child,{},[],()=>{}),/Invalid AS3 class initializer/);
 const rows=[{kind:'class',qname:'test.Base',base:null,interfaces:[],sourceSha256:'a'.repeat(64),fields:[],constructor:Base,predicate:()=>false,constructionTarget:()=>null,constructionProof:value=>value===baseProof},
  {kind:'class',qname:'test.Child',base:'test.Base',interfaces:[],sourceSha256:'b'.repeat(64),fields:[],constructor:Child,predicate:()=>false,constructionTarget:()=>null,constructionProof:value=>value===childProof}];
 const metadata={schema:'as3-runtime-type-authority@1',qnames:rows.map(r=>r.qname),entries:rows.map(({constructor,predicate,constructionTarget,constructionProof,...row})=>row)};
 registry.installAS3TypeAuthority({schema:metadata.schema,sha256:crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex'),qnames:metadata.qnames,entries:rows});
 assert.equal(initialize(Child),Child);assert.equal(initialize(Child),Child);
 assert.deepEqual(events,['base','child']);assert.equal(Base.value,11);assert.equal(Child.child,12);
 assert.equal(Object.getOwnPropertyDescriptor(Base,'value').writable,false);
 assert.throws(()=>field(Child,childProof,'child',99),/not active/);
 define(Foreign,childProof,[],()=>events.push('forged'));
 assert.throws(()=>initialize(Foreign),/lacks sealed construction authority/);assert.deepEqual(events,['base','child']);
});
