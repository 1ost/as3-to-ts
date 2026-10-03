const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),z=require('node:zlib');
const root=path.resolve(__dirname,'../..'),expected=require('./verify.cjs'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function check(r){
 assert.equal(r.runnerSha256,hash(fs.readFileSync(path.join(__dirname,'run.cjs'))));assert.equal(r.observerSha256,hash(fs.readFileSync(path.join(__dirname,'observer.ts'))));
 for(const input of r.compilerInputs)assert.equal(hash(fs.readFileSync(path.join(root,input.file),'utf8').replace(/\r\n/g,'\n')),input.sha256,input.file);
 for(const [q,s]of Object.entries(r.cohorts.subject))assert.equal(hash(fs.readFileSync(path.join(__dirname,'source',q+'.as'))),s.sourceSha256);
 assert.deepEqual(r.results.map(x=>x.target),['ES5','ES2015']);
 for(const x of r.results){assert.deepEqual(x.node,x.web);assert.deepEqual(x.web.rows,expected);assert.equal(x.rejectionGuards,8);assert.equal(x.mutations,1);assert.equal(x.artifacts.subject.generatedSources.length,2);
  for(const t of x.typechecks){assert.deepEqual(t.diagnostics,[]);assert.equal(t.guards,8);}
  for(const c of x.controls){assert.equal(c.applied,2);assert.equal(c.mode,'start-stops');assert.deepEqual(c.node,c.result);assert.notDeepEqual(c.result.rows,expected);}
 }
}
function current(r){for(const x of r.results)for(const i of [...x.bundleInputs,...x.typechecks.flatMap(t=>t.inputs)])assert.equal(hash(fs.readFileSync(i.file)),i.sha256,i.file);}
if(process.argv[2]==='--retain'){const raw=fs.readFileSync(process.argv[3]),r=JSON.parse(raw);check(r);current(r);const bytes=z.gzipSync(raw,{level:9});fs.writeFileSync(path.join(__dirname,'runtime.json.gz'),bytes);fs.writeFileSync(path.join(__dirname,'runtime-pin.json'),JSON.stringify({sha256:hash(bytes)},null,2)+'\n');}
const bytes=fs.readFileSync(path.join(__dirname,'runtime.json.gz'));assert.equal(hash(bytes),require('./runtime-pin.json').sha256);const r=JSON.parse(z.gunzipSync(bytes));check(r);if(process.argv.includes('--check-current'))current(r);console.log(JSON.stringify({airRows:15,targets:2,realms:2,guardsPerTarget:8,mutationsPerTarget:1,typeErrors:0}));

const adjacentBytes=fs.readFileSync(path.join(__dirname,'regressions.json.gz'));assert.equal(hash(adjacentBytes),require('./regressions-pin.json').sha256);const adjacent=JSON.parse(z.gunzipSync(adjacentBytes));
assert.deepEqual(adjacent.bytearray.typecheck.diagnostics,[]);assert.equal(adjacent.bytearray.rejectionGuards,10);assert.deepEqual(adjacent.bytearray.results.map(x=>x.target),[1,2]);
for(const x of adjacent.bytearray.results){assert.deepEqual(x.node,x.web);assert.equal(x.node.length,16);}
assert.deepEqual(adjacent.drag.results.map(x=>x.target),['ES5','ES2015']);for(const x of adjacent.drag.results){assert.equal(x.web.rows.length,12);assert.equal(x.pointerChecks,2);assert.equal(x.compilerGuards,6);for(const t of x.typechecks)assert.deepEqual(t.diagnostics,[]);}
console.log(JSON.stringify({adjacentAirRows:28,targets:2,bytearrayRealms:2,dragChromium:true}));
