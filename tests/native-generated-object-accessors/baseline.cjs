'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {compile,root,engine,sources,hash}=require('./compile.cjs');
const expected=require('./oracle/verify.cjs');assert.equal(expected.length,28);assert.equal(Object.keys(sources).length,7);
const baseline='d1fcd69ed579ec86a351ec88b091ed4d85b2e7d1';
assert.equal(cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),baseline);
assert.equal(cp.execFileSync('git',['diff','HEAD','--','src','utils'],{cwd:root,encoding:'utf8'}).trim(),'');
const cache=path.join(root,'.cache/native-generated-object-accessors');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'baseline-'));
const results=[];
for(const target of ['ES5','ES2015'])for(const [name,names,subject]of [
 ['complete',Object.keys(sources),'PairChild'],
 ['getter-ancestry',['ReadBase','ReadChild','ReadGrand'].map(n=>'cases.'+n),'ReadChild'],
 ['setter-ancestry',['WriteBase','WriteChild'].map(n=>'cases.'+n),'WriteChild']
]){
 const selected=Object.fromEntries(names.map(n=>[n,sources[n]]));
 const reason=name==='complete'?'inherited collision/partial override requires authority':'duplicate or incompatible public declaration';
 const message='AS3_GENERATED_TRAITS_UNSUPPORTED: '+reason+': cases.'+subject+':value';
 assert.throws(()=>compile(path.join(out,target,name),target,selected),error=>error.message===message);
 results.push({target,name,message,sourceClasses:names.length});
}
const inputs={};function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else inputs[path.relative(root,f).replaceAll('\\','/')]=hash(fs.readFileSync(f));}}
for(const directory of ['src','lib','utils'])walk(path.join(root,directory));
for(const file of ['baseline.cjs','compile.cjs','oracle/evidence-pin.json'])inputs['tests/native-generated-object-accessors/'+file]=hash(fs.readFileSync(path.join(__dirname,file)));
const report={baseline,engineCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim(),originalRows:28,sources:Object.fromEntries(Object.entries(sources).map(([n,s])=>[n,s.sourceSha256])),inputs,results};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,status:'baseline-reproduced',targets:2,rejections:results.length,originalRows:28}));
