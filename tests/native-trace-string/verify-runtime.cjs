const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),z=require('node:zlib');
const root=path.resolve(__dirname,'../..'),expected=require('./verify.cjs'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function check(r){
 assert.equal(r.guardsSha256,hash(fs.readFileSync(path.join(__dirname,'guards.cjs'))));
 assert.equal(r.runnerSha256,hash(fs.readFileSync(path.join(__dirname,'run.cjs'))));assert.equal(r.observerSha256,hash(fs.readFileSync(path.join(__dirname,'observer.ts'))));
 for(const input of r.compilerInputs)assert.equal(hash(fs.readFileSync(path.join(root,input.file),'utf8').replace(/\r\n/g,'\n')),input.sha256,input.file);
 for(const [q,s]of Object.entries(r.cohorts.subject))assert.equal(hash(fs.readFileSync(path.join(__dirname,'source',q+'.as'))),s.sourceSha256);
 assert.deepEqual(r.results.map(x=>x.target),['ES5','ES2015']);
 for(const x of r.results){assert.deepEqual(x.node,x.web);assert.deepEqual(x.web,expected);assert.equal(x.rejectionGuards,15);assert.equal(x.mutations,1);assert.equal(x.artifacts.subject.generatedSources.length,2);
  for(const t of x.typechecks){assert.deepEqual(t.diagnostics,[]);assert.equal(t.guards,15);}
  for(const c of x.controls){assert.equal(c.applied,2);assert.equal(c.mode,'wrong-string-hint');assert.deepEqual(c.node,c.result);assert.notDeepEqual(c.result,expected);}
 }
}
function current(r){for(const x of r.results)for(const i of [...x.bundleInputs,...x.typechecks.flatMap(t=>t.inputs)])assert.equal(hash(fs.readFileSync(i.file)),i.sha256,i.file);}
if(process.argv[2]==='--retain'){const raw=fs.readFileSync(process.argv[3]),r=JSON.parse(raw);check(r);current(r);const bytes=z.gzipSync(raw,{level:9});fs.writeFileSync(path.join(__dirname,'runtime.json.gz'),bytes);fs.writeFileSync(path.join(__dirname,'runtime-pin.json'),JSON.stringify({sha256:hash(bytes)},null,2)+'\n');}
const bytes=fs.readFileSync(path.join(__dirname,'runtime.json.gz'));assert.equal(hash(bytes),require('./runtime-pin.json').sha256);const r=JSON.parse(z.gunzipSync(bytes));check(r);if(process.argv.includes('--check-current'))current(r);console.log(JSON.stringify({airRows:2,traceLines:16,targets:2,realms:2,guardsPerTarget:15,mutationsPerTarget:1,typeErrors:0}));
