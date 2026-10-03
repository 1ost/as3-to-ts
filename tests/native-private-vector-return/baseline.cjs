const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
require('./verify-oracle.cjs');
const {compile,root,hash,sources}=require('./compile.cjs');
const commit='40379d5891ec2ed5ff81397472bd6b4886ab322d';
assert.equal(cp.execFileSync('git',['diff','--name-only',commit,'--','src','utils','tsconfig.json','package.json','package-lock.json'],{cwd:root,encoding:'utf8'}).trim(),'');
const cache=path.join(root,'.cache/native-private-vector-return');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'baseline-'));
const results=[];for(const target of ['ES5','ES2015']){
 let message;try{compile(path.join(out,target),target);}catch(error){message=error.message;}
 assert.equal(message,'AS3_GENERATED_LEXICAL_UNSUPPORTED: lexical vector storage authority');results.push({target,message});
}
const compilerInputs=cp.execFileSync('git',['ls-files','src','utils'],{cwd:root,encoding:'utf8'}).trim().split('\n').map(file=>({file,sha256:hash(fs.readFileSync(path.join(root,file)))}));
const libInputs=[];function collect(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())collect(file);else libInputs.push({file:path.relative(root,file),sha256:hash(fs.readFileSync(file))});}}collect(path.join(root,'lib'));
fs.writeFileSync(path.join(__dirname,'baseline.json'),JSON.stringify({commit,sourceHashes:Object.fromEntries(Object.entries(sources).map(([q,s])=>[q,s.sourceSha256])),results,compilerInputs,libInputs},null,2)+'\n');
console.log(JSON.stringify({commit,results}));
