'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{fork,spawnSync}=require('node:child_process');
const {inspectSourceIncludes,loadSourceIncludes}=require('../../lib/source-includes.js');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixture(){const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'as3-includes-'));const put=(p,s)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),s);};return {root,put};}
function declaration(root,name,authority){return new Promise((resolve,reject)=>{const worker=path.resolve(__dirname,'../../lib/declaration-worker.js'),child=fork(worker,[],{stdio:['ignore','ignore','pipe','ipc']});let stderr='';child.stderr.on('data',b=>stderr+=b);child.on('error',reject);child.on('message',result=>{assert.equal(stderr,'');resolve(result);});child.send({sourcePath:name,content:fs.readFileSync(path.join(root,name),'utf8'),includeRootPath:name,includeFragments:authority.fragments,includeEdges:authority.inventory.edges,maxResultBytes:4000000,workerSha256:sha(fs.readFileSync(worker))});});}
test('source includes retain raw roots, nested fragment provenance, namespace import and constant',async()=>{const {root,put}=fixture();try{
const source='package one { import shared.ns; public class Owner { include "parts/Version.as"; public function Owner(){ } public static function value():String { return "ok"; } } }';
put('one/Owner.as',source);put('one/parts/Version.as','import shared.ns;\r\ninclude "Nested.as";\r\n');put('one/parts/Nested.as','ns static const VERSION:String="one";');
put('two/Owner.as',source.replace('package one','package two'));put('two/parts/Version.as','import shared.ns; ns static const VERSION:String="two";');
const inventory=inspectSourceIncludes(root,['two/Owner.as','one/Owner.as']);assert.equal(inventory.fragments.length,3);assert.equal(inventory.edges.length,3);assert.deepEqual(inventory.imports.map(i=>[i.rootPath,i.ownerPath,i.qname]),[['one/Owner.as','one/Owner.as','shared.ns'],['one/Owner.as','one/parts/Version.as','shared.ns'],['two/Owner.as','two/Owner.as','shared.ns'],['two/Owner.as','two/parts/Version.as','shared.ns']]);
const authority=loadSourceIncludes(JSON.stringify(inventory));const forged=structuredClone(inventory);forged.edges[0].directiveStart++;assert.throws(()=>loadSourceIncludes(JSON.stringify(forged)),/exact source include closure/);const missingEdge=structuredClone(authority);missingEdge.inventory.edges=[];const held=await declaration(root,'one/Owner.as',missingEdge);assert.equal(held.ok,false);assert.match(held.error,/parser directives differ/);for(const name of ['one/Owner.as','two/Owner.as']){const reply=await declaration(root,name,authority);assert.equal(reply.ok,true,reply.error);const d=JSON.parse(reply.json);assert.equal(d.sourceSha256,sha(fs.readFileSync(path.join(root,name))));assert.deepEqual(d.imports,['shared.ns']);const field=d.members.find(m=>m.name==='VERSION');assert.equal(field.namespaceName,'ns');assert.equal(field.readonly,true);}
assert.equal(fs.readFileSync(path.join(root,'one/Owner.as'),'utf8'),source);assert.match(fs.readFileSync(path.join(root,'one/parts/Version.as'),'utf8'),/\r\n/);
put('one/parts/Nested.as','ns static const VERSION:String="tampered";');assert.throws(()=>loadSourceIncludes(JSON.stringify(inventory)),/exact source include closure/);
}finally{fs.rmSync(root,{recursive:true,force:true});}});

test('AIR accepts one exact package import repeated by a class include',{skip:!process.env.HARDENED_FIXTURE_AIR_SDK},async()=>{
 const {root,put}=fixture();try{
  const sdk=fs.realpathSync(process.env.HARDENED_FIXTURE_AIR_SDK);
  put('DuplicateImportProbe.as','package { import flash.display.Sprite; import flash.utils.ByteArray; public final class DuplicateImportProbe extends Sprite { include "DuplicateImportInclude.as"; public function DuplicateImportProbe(){var value:ByteArray=new ByteArray();trace(value.length);} } }\n');
  put('DuplicateImportInclude.as','import flash.utils.ByteArray;\n');
  const compiler=path.join(sdk,'lib/mxmlc-cli.jar'),output=path.join(root,'probe.swf');
  const result=spawnSync('java',['-Xmx1024m','-Dflexlib='+path.join(sdk,'frameworks'),'-jar',compiler,
   '+flexlib='+path.join(sdk,'frameworks'),'+configname=air','-source-path='+root,'-debug=true',
   '-omit-trace-statements=false','-output='+output,path.join(root,'DuplicateImportProbe.as')],{encoding:'utf8',timeout:180000});
  assert.equal(result.status,0,result.stdout+result.stderr);assert.ok(fs.statSync(output).size>0);
  const authority=loadSourceIncludes(JSON.stringify(inspectSourceIncludes(root,['DuplicateImportProbe.as'])));
  const reply=await declaration(root,'DuplicateImportProbe.as',authority);assert.equal(reply.ok,true,reply.error);
  assert.deepEqual(JSON.parse(reply.json).imports,['flash.display.Sprite','flash.utils.ByteArray']);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('include inventory rejects missing, cycle, escape and symlink, ignores literals/comments',()=>{const {root,put}=fixture();try{
put('Owner.as','package { public class Owner { include "Missing.as"; } }');assert.throws(()=>inspectSourceIncludes(root,['Owner.as']),/ENOENT/);
put('Missing.as','include "Owner.as";');assert.throws(()=>inspectSourceIncludes(root,['Owner.as']),/INCLUDE_CYCLE/);
put('Owner.as','package { public class Owner { include "../escape.as"; } }');assert.throws(()=>inspectSourceIncludes(root,['Owner.as']),/INCLUDE_PATH/);
put('Owner.as','package { public class Owner { include "Link.as"; } }');put('Real.as','public var x:int=1;');fs.symlinkSync(path.join(root,'Real.as'),path.join(root,'Link.as'));assert.throws(()=>inspectSourceIncludes(root,['Owner.as']),/INCLUDE_PATH/);
put('Owner.as','package { public class Owner { public var value:String="include \\\"Missing.as\\\""; /* include "Missing.as"; */ } }');assert.equal(inspectSourceIncludes(root,['Owner.as']).fragments.length,0);
put('Owner.as','package { public class Owner { include path; } }');assert.throws(()=>inspectSourceIncludes(root,['Owner.as']),/INCLUDE_LITERAL/);
}finally{fs.rmSync(root,{recursive:true,force:true});}});

test('include depth limit fails closed before unbounded expansion',()=>{const {root,put}=fixture();try{put('Owner.as','package { public class Owner { include "P0.as"; } }');for(let i=0;i<34;i++)put('P'+i+'.as','include "P'+(i+1)+'.as";');put('P34.as','public var value:int=1;');assert.throws(()=>inspectSourceIncludes(root,['Owner.as']),/INCLUDE_BUDGET/);}finally{fs.rmSync(root,{recursive:true,force:true});}});

test('orphan and comment-forged fragments cannot suppress standalone inputs',()=>{const {root,put}=fixture();try{put('Owner.as','package { public class Owner {} } // include "Bad.as";');put('Bad.as','unsupported standalone input');const inventory=inspectSourceIncludes(root,['Owner.as']);inventory.fragments.push({path:'Bad.as',sha256:sha(fs.readFileSync(path.join(root,'Bad.as'))),bytes:fs.statSync(path.join(root,'Bad.as')).size});assert.throws(()=>loadSourceIncludes(JSON.stringify(inventory)),/exact source include closure/);}finally{fs.rmSync(root,{recursive:true,force:true});}});

test('namespace literal URI is source-bound; dynamic initialization remains held',async()=>{const {root,put}=fixture();try{put('ns.as','package fixture { public namespace ns="urn:exact"; }');const a=loadSourceIncludes(JSON.stringify(inspectSourceIncludes(root,['ns.as'])));const good=await declaration(root,'ns.as',a);assert.equal(good.ok,true,good.error);assert.equal(JSON.parse(good.json).members[0].namespaceUri,'urn:exact');put('ns.as','package fixture { public namespace ns=make(); }');const b=loadSourceIncludes(JSON.stringify(inspectSourceIncludes(root,['ns.as'])));const bad=await declaration(root,'ns.as',b);assert.equal(bad.ok,false);assert.match(bad.error,/HARDENED_NAMESPACE_INITIALIZER/);}finally{fs.rmSync(root,{recursive:true,force:true});}});

test('regexp operands and control statements never invent includes; keyword member division retains following include',()=>{const {root,put}=fixture();try{put('Real.as','public var value:int=1;');for(const body of ['throw /include "Ghost.as"/;','if (condition) /include "Ghost.as"/.test(value);','while (condition) /include "Ghost.as"/.test(value);','return /import missing.Namespace; include "Ghost.as"/;','if (condition) {} /include "Ghost.as"/.test(value);','var n=object.return / 2;','var n=function(){} / 2;','for each(var item:Object in items) /include "Ghost.as"/.test(item);']){put('Owner.as','package {public class Owner {public function test():void{'+body+'} include "Real.as";}}');const inventory=inspectSourceIncludes(root,['Owner.as']);assert.deepEqual(inventory.fragments.map(x=>x.path),['Real.as']);assert.equal(inventory.edges.length,1);assert.deepEqual(inventory.imports,[]);}}finally{fs.rmSync(root,{recursive:true,force:true});}});
