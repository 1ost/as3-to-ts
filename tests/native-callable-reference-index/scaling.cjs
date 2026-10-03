const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {compile,hash,root}=require('../native-generated-error-event-construction/compile.cjs');
const cache=path.join(root,'.cache/native-callable-reference-scaling');fs.mkdirSync(cache,{recursive:true});
const out=fs.mkdtempSync(path.join(cache,'run-')),sources={};
const add=(name,body)=>{const source='package scaling { public class '+name+' { '+body+' } }';sources['scaling.'+name]={source,sourceSha256:hash(source)};};
for(const name of ['Item0','Item1'])add(name,'public function '+name+'() {}');
// Equal-length names give distinct owners identical source offsets. The
// references must remain associated with their declaring source class.
for(let i=0;i<64;i++){const name='C'+String(i).padStart(2,'0');const type='Item'+(i%2);add(name,'public var value:'+type+'; public function '+name+'(value:'+type+'=null) { this.value=value; }');}
const results=[];
for(const target of ['ES5','ES2015']){
 const {artifact,plan}=compile(path.join(out,target),target,sources);
 assert.equal(plan.bindings.length,66);assert.equal(plan.references.filter(r=>r.kind==='unresolved').length,0);
 results.push({target,sourceClasses:66,references:plan.references.length,artifactSha256:hash(JSON.stringify(artifact))});
}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({results},null,2)+'\n');
console.log(JSON.stringify({out,status:'passed'}));
