const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
require('./verify-oracle.cjs');
const {compile,root,hash}=require('../native-generated-anonymous-members/compile.cjs');
const commit='a56bea4cc5328ee2e3ca3d0f0cacff33d9feb084';
assert.equal(cp.execFileSync('git',['diff','--name-only',commit,'--','src','utils','tsconfig.json','package.json','package-lock.json'],{cwd:root,encoding:'utf8'}).trim(),'');
const source=fs.readFileSync(path.join(__dirname,'oracle/evidence/source/cases/NestedClosure.as'),'utf8');
const sources={'cases.NestedClosure':{source,sourceSha256:hash(source)}};
const cache=path.join(root,'.cache/native-generated-nested-anonymous');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'baseline-'));
const results=[];for(const target of ['ES5','ES2015']){
 let message;try{compile(path.join(out,target),target,sources);}catch(error){message=error.message;}
 assert.equal(message,'AS3_GENERATED_LEXICAL_UNSUPPORTED: nested anonymous callable body held');
 results.push({target,message});
}
const compilerInputs=cp.execFileSync('git',['ls-files','src','utils'],{cwd:root,encoding:'utf8'}).trim().split('\n').map(file=>({file,sha256:hash(fs.readFileSync(path.join(root,file)))}));
const libInputs=[];function collect(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())collect(file);else libInputs.push({file:path.relative(root,file),sha256:hash(fs.readFileSync(file))});}}collect(path.join(root,'lib'));
fs.writeFileSync(path.join(__dirname,'baseline.json'),JSON.stringify({commit,sourceSha256:hash(source),results,compilerInputs,libInputs},null,2)+'\n');
console.log(JSON.stringify({commit,results}));
