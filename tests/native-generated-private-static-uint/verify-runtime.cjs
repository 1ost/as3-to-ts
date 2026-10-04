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
common(r,expected,14,2,__dirname);
for(const [name,s]of Object.entries(r.cohorts.parent))assert.equal(hash(fs.readFileSync(path.join(__dirname,'source',name.replaceAll('.','/')+'.as'))),s.sourceSha256);
for(const t of r.results){assert.equal(t.uintControl.applied,true);assert.deepEqual(t.uintControl.node,t.uintControl.web);assert.notDeepEqual(t.uintControl.node.rows.find(x=>x.id==='uint-initialization'),expected.find(x=>x.id==='uint-initialization'));}
const b=require('./baseline-pin.json');assert.equal(hash(fs.readFileSync(path.join(__dirname,'baseline.log'))),b.logSha256);assert.match(fs.readFileSync(path.join(__dirname,'baseline.log'),'utf16le'),/AS3_GENERATED_LEXICAL_UNSUPPORTED: static lexical primitive initializer requires qualification/);assert.equal(hash(fs.readFileSync(path.join(__dirname,'run.cjs'))),b.runnerSha256);assert.equal(hash(fs.readFileSync(path.join(__dirname,'baseline.cjs'))),b.replaySha256);for(const [n,s]of Object.entries(b.sources))assert.equal(hash(fs.readFileSync(path.join(__dirname,n))),s);
const a=read('regressions');common(a.dispatcher,require(path.join(engine,'tests/nativeFlashOracle/generated-dispatcher-script-retry/verify.cjs')),5,1,path.join(root,'tests/native-generated-dispatcher-script-retry'));
const u=a.updates,ue=require(path.join(engine,'tests/nativeFlashOracle/generated-lexical-numeric-updates/verify.cjs'));assert.equal(u.rejectionGuards,4);assert.deepEqual(u.typecheck.diagnostics,[]);assert.deepEqual(u.results.map(t=>t.target),[1,2]);for(const t of u.results){assert.deepEqual(t.node,t.web);assert.deepEqual(t.node,ue);}
if(process.argv.includes('--check-current')){for(const i of u.providerGraph)assert.equal(hash(fs.readFileSync(path.resolve(engine,i.file))),i.sha256);assert.equal(hash(fs.readFileSync(u.observer.files[0])),u.observer.sha256);}
console.log(JSON.stringify({airRows:22,targets:2,realms:2,guardsPerTarget:14,typeErrors:0,numericMutationRealms:2,retryIdentityMutationRealms:1,adjacentRows:41}));
