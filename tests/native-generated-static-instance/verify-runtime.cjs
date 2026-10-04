const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),z=require('node:zlib'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),p=require('./engine.json'),engine=path.resolve(root,p.checkout),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(cp.execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim(),p.commit);
const read=n=>{const b=fs.readFileSync(path.join(__dirname,n+'.json.gz'));assert.equal(hash(b),require('./'+n+'-pin.json').sha256);return JSON.parse(z.gunzipSync(b));};
const expected=require('./verify.cjs'),r=read('runtime');
function common(report,rows,guards,mutations,dir){
 assert.deepEqual(report.results.map(x=>x.target),['ES5','ES2015']);
 assert.equal(report.runnerSha256,hash(fs.readFileSync(path.join(dir,'run.cjs'))));assert.equal(report.observerSha256,hash(fs.readFileSync(path.join(dir,'observer.ts'))));
 for(const t of report.results){assert.deepEqual(t.node,t.web);assert.deepEqual(t.node.rows,rows);assert.deepEqual(t.node.domainChecks,Array(9).fill(true));assert.equal(t.rejectionGuards,guards);assert.equal(t.mutations,mutations);assert(t.typechecks.length>0);for(const c of t.typechecks)assert.deepEqual(c.diagnostics,[]);}
 if(process.argv.includes('--check-current'))for(const i of [...report.compilerInputs,...report.results.flatMap(t=>[...t.inputs,...t.typechecks.flatMap(c=>c.inputs)])])assert.equal(hash(fs.readFileSync(path.resolve(root,i.file))),i.sha256,i.file);
}
common(r,expected,16,2,__dirname);
for(const [name,s]of Object.entries(r.cohorts.parent))assert.equal(hash(fs.readFileSync(path.join(__dirname,'source',name.replaceAll('.','/')+'.as'))),s.sourceSha256);
for(const t of r.results){assert.equal(t.instanceControl.applied,true);assert.deepEqual(t.instanceControl.node,t.instanceControl.web);assert.notDeepEqual(t.instanceControl.node.rows.find(x=>x.id==='static-instance'),expected.find(x=>x.id==='static-instance'));}
const b=require('./baseline-pin.json');assert.equal(hash(fs.readFileSync(path.join(__dirname,'baseline.log'))),b.logSha256);assert.match(fs.readFileSync(path.join(__dirname,'baseline.log'),'utf16le'),/AS3_GENERATED_LEXICAL_UNSUPPORTED: instance lexical access in static method/);assert.equal(hash(fs.readFileSync(path.join(__dirname,'run.cjs'))),b.runnerSha256);assert.equal(hash(fs.readFileSync(path.join(__dirname,'baseline.cjs'))),b.replaySha256);for(const [n,s]of Object.entries(b.sources))assert.equal(hash(fs.readFileSync(path.join(__dirname,n))),s);
const a=read('regressions');
const original=file=>cp.execFileSync('git',['show',a.engineCommit+':tests/nativeFlashOracle/descendant-private-receiver/fields/'+file],{cwd:engine,maxBuffer:16*1024*1024});
const receipt=JSON.parse(original('evidence/receipt.json'));assert.equal(hash(original('evidence/receipt.json')),a.receiptSha256);
const capture=original('evidence/run-1/capture.json');assert.equal(hash(capture),receipt.artifacts['run-1/capture.json']);const rows=JSON.parse(capture).state.observations;
assert.deepEqual(a.runs.map(t=>t.target),['ES5','ES2015']);for(const t of a.runs){assert.deepEqual(t.node,t.web);assert.deepEqual(t.node,rows);assert.equal(t.guards.length,6);assert.match(t.controlError,/lexical receiver requires exact source type/);assert.deepEqual(t.typecheck.diagnostics,[]);}
for(const i of a.runnerInputs)assert.equal(hash(fs.readFileSync(path.join(root,'tests/native-generated-descendant-private-receiver',i.file))),i.sha256);
if(process.argv.includes('--check-current'))for(const i of [...a.compilerInputs,...a.runs.flatMap(t=>[...t.inputs,...t.typecheck.inputs])])assert.equal(hash(fs.readFileSync(path.resolve(root,i.file))),i.sha256,i.file);
console.log(JSON.stringify({airRows:26,targets:2,realms:2,guardsPerTarget:16,typeErrors:0,instanceMutationRealms:2,retryIdentityMutationRealms:1,adjacentRows:11}));
