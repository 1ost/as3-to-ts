const fs=require('fs'),path=require('path'),assert=require('assert/strict'),cp=require('child_process');
const {compile,root,hash}=require('./compile.cjs');
const commit='577d2e105a1bb71d4cc77b0266c19c7fd6e077bd';
assert.equal(cp.execFileSync('git',['diff','--name-only',commit,'--','src','utils','tsconfig.json','package.json','package-lock.json'],{cwd:root,encoding:'utf8'}).trim(),'');
const cache=path.join(root,'.cache/native-generated-anonymous-members');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'baseline-'));
const results=[];
for(const target of ['ES5','ES2015']){
 let message;try{compile(path.join(out,target),target);}catch(error){message=error.message;}
 assert.match(message||'',/AS3_GENERATED_LEXICAL_UNSUPPORTED: anonymous callable receiver\/member lookup held/);
 results.push({target,message});
}
const compilerInputs=cp.execFileSync('git',['ls-files','src'],{cwd:root,encoding:'utf8'}).trim().split('\n').map(file=>({file,sha256:hash(fs.readFileSync(path.join(root,file)))}));
const libInputs=[];function collect(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())collect(file);else libInputs.push({file:path.relative(root,file),sha256:hash(fs.readFileSync(file))});}}collect(path.join(root,'lib'));
fs.writeFileSync(path.join(__dirname,'baseline.json'),JSON.stringify({commit,results,compilerInputs,libInputs},null,2)+'\n');console.log(JSON.stringify({commit,results}));
