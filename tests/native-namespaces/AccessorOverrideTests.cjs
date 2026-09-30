'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process'),Module=require('node:module'),ts=require('typescript');
const parse=require('../../lib/parse'),{NativeNamespaces}=require('../../lib/emit/native-namespaces');
const {createNativeSourceAncestryPlan}=require('../../lib/emit/native-source-ancestry');
const root=path.resolve(__dirname,'../..'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2-namespace-traits-review');
const engineCommit='0e85a408b7b3cfe7041ec20e938b6a58309d3dca',baselineCommit='04057b67a038c18425e580c390a3a2e672b123a2';
const gitBytes=(cwd,commit,file)=>execFileSync('git',['show',commit+':'+file],{cwd,maxBuffer:16*1024*1024});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const evidence='tests/nativeGeneratedNamespaceTraits/evidence/';
const receipt=JSON.parse(gitBytes(engine,engineCommit,evidence+'receipt.json'));
const captures=[1,2].map(n=>{
 const file='run-'+n+'/capture.json',bytes=gitBytes(engine,engineCommit,evidence+file);
 assert.equal(sha(bytes),receipt.artifacts[file]);return JSON.parse(bytes);
});
assert.deepEqual(captures[0],captures[1]);assert.equal(captures[0].state.observations.length,46);
const names=['alpha','beta','RegistryBase','RegistryChild','RegistryGrandchild'];
const sources=Object.fromEntries(names.map(name=>{
 const file='source/cases/'+name+'.as',bytes=gitBytes(engine,engineCommit,evidence+file);
 assert.equal(sha(bytes),receipt.artifacts[file]);
 return ['cases.'+name,{source:bytes.toString('utf8'),sourceSha256:sha(bytes)}];
}));
const ancestry=createNativeSourceAncestryPlan({sources});assert.deepEqual(ancestry.parseErrors,{});
const normalize=node=>{node.children=node.children.filter(Boolean);node.children.forEach(child=>{child.parent=node;normalize(child);});};
function resolve(Compiler,source,plan){const ast=parse('AccessorOverrides.as',source);normalize(ast);return new Compiler(ast,source,plan&&plan.namespaceUris,false,plan);}
for(const name of names)resolve(NativeNamespaces,sources['cases.'+name].source,ancestry);
// An applied baseline control proves that both original child declarations
// reach the repaired lookup. It does not replace the AIR runtime comparison.
const baselineSource=gitBytes(root,baselineCommit,'src/emit/native-namespaces.ts').toString('utf8');
const compiled=ts.transpileModule(baselineSource,{compilerOptions:{target:ts.ScriptTarget.ES2018,module:ts.ModuleKind.CommonJS}}).outputText;
const moduleFile=path.join(root,'lib/emit/native-namespaces.control.js'),control=new Module(moduleFile,module);
control.filename=moduleFile;control.paths=Module._nodeModulePaths(path.dirname(moduleFile));control._compile(compiled,moduleFile);
for(const name of ['RegistryChild','RegistryGrandchild'])assert.throws(()=>resolve(control.exports.NativeNamespaces,sources['cases.'+name].source,ancestry),/namespace override requires a matching inherited member: count/);
const get='n function get value():int {return 1;}',set='n function set value(v:int):void {}';
const unit=(base,middle,leaf)=>`package local {public namespace n="urn:a";public namespace other="urn:b";public class Base {${base}} public class Middle extends Base {${middle}} public class Leaf extends Middle {${leaf}}}`;
let accepted=5,guards=0;
for(const halves of [get+set,set+get])for(const [first,second]of [[get,set],[set,get]]){
 resolve(NativeNamespaces,unit(halves,'override '+first,'override '+second));accepted++;
}
for(const source of [
 unit(set,'override '+get,''),unit(get,'override '+set,''),
 unit(get,'override '+get.replace('n function','other function'),''),
 unit(get,'override '+get.replace('n function','n static function'),''),
 unit('', 'override '+get,''),unit(get,get,''),
 // A different declaration kind cannot hide an older matching accessor.
 unit(get,'n function value():int {return 2;}','override '+get),
 unit(set,'n var value:int;','override '+set)
]){assert.throws(()=>resolve(NativeNamespaces,source),/AS3_NAMESPACE_UNSUPPORTED/);guards++;}
const report={status:'passed',scope:'namespace declaration resolution only; generated runtime remains unqualified',accepted,guards,
 appliedBaselineControls:2,engineCommit,baselineCommit,sourceHashes:ancestry.sourceHashes,
 airReceiptSha256:sha(gitBytes(engine,engineCommit,evidence+'receipt.json')),
 compilerSourceSha256:sha(fs.readFileSync(path.join(root,'src/emit/native-namespaces.ts')))};
console.log(JSON.stringify(report,null,2));
