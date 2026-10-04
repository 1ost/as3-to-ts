const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),pin=require('./engine.json');
const engine=path.resolve(root,pin.checkout);
assert.equal(cp.execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim(),pin.commit);
const packet=fs.readFileSync(path.join(__dirname,'runtime.json.gz'));
assert.equal(hash(packet),require('./runtime-pin.json').sha256);
const r=JSON.parse(z.gunzipSync(packet)),expected=require('./verify.cjs');
assert.equal(r.runnerSha256,hash(fs.readFileSync(path.join(__dirname,'run.cjs'))));
assert.equal(r.observerSha256,hash(fs.readFileSync(path.join(__dirname,'observer.ts'))));
assert.deepEqual(r.results.map(t=>t.target),['ES5','ES2015']);
for(const t of r.results){
 assert.deepEqual(t.node.rows,expected);assert.deepEqual(t.node,t.web);
 assert.equal(t.rejectionGuards,9);assert.equal(t.mutations,3);assert.equal(t.controls.length,3);
 for(const c of t.controls){assert.equal(c.applied,true);assert.deepEqual(c.node,c.web);assert.notDeepEqual(c.node.rows.find(x=>x.id===c.row),expected.find(x=>x.id===c.row));}
 for(const c of t.typechecks)assert.deepEqual(c.diagnostics,[]);
}
for(const [q,s]of Object.entries(r.cohorts.parent))assert.equal(hash(fs.readFileSync(path.join(__dirname,'source',q.replaceAll('.','/')+'.as'))),s.sourceSha256);
const b=require('./baseline-pin.json');
for(const [file,sha]of Object.entries(b.files))assert.equal(hash(fs.readFileSync(path.join(__dirname,file))),sha,file);
assert.deepEqual(fs.readFileSync(path.join(__dirname,'baseline.log'),'utf16le').replace(/^\ufeff/,'').trim().split(/\r?\n/).map(s=>JSON.parse(s)),[{target:'ES5',baseline:true},{target:'ES2015',baseline:true}]);
if(process.argv.includes('--check-current'))for(const i of [...r.compilerInputs,...r.results.flatMap(t=>[...t.inputs,...t.typechecks.flatMap(c=>c.inputs)])])assert.equal(hash(fs.readFileSync(path.resolve(root,i.file))),i.sha256,i.file);
const rb=fs.readFileSync(path.join(__dirname,'regressions.json.gz'));
assert.equal(hash(rb),require('./regressions-pin.json').sha256);
const regression=JSON.parse(z.gunzipSync(rb)),object=regression.object,nested=regression.nested;
const objectDir=path.join(root,'tests/native-generated-anonymous-object-return');
assert.equal(object.runnerSha256,hash(fs.readFileSync(path.join(objectDir,'run.cjs'))));
assert.equal(object.observerSha256,hash(fs.readFileSync(path.join(objectDir,'observer.ts'))));
const objectRows=require(path.join(engine,'tests/nativeFlashOracle/anonymous-object-return/verify.cjs'));
assert.deepEqual(object.results.map(t=>t.target),['ES5','ES2015']);
for(const t of object.results){assert.deepEqual(t.node.rows,objectRows);assert.deepEqual(t.node,t.web);assert.equal(t.rejectionGuards,6);assert.equal(t.mutations.length,2);for(const c of t.typechecks)assert.deepEqual(c.diagnostics,[]);}
const nestedDir=path.join(root,'tests/native-generated-nested-anonymous'),nestedRows=require(path.join(nestedDir,'verify-oracle.cjs'));
for(const i of nested.runnerInputs)assert.equal(hash(fs.readFileSync(path.resolve(nestedDir,i.file))),i.sha256,i.file);
assert.deepEqual(nested.runs.map(t=>t.target),['ES5','ES2015']);
for(const t of nested.runs){assert.deepEqual(t.actual.node,t.actual.web);assert.deepEqual(t.actual.node.rows,nestedRows);assert.equal(t.guards.length,11);assert.equal(t.controls.length,2);assert.deepEqual(t.typecheck.diagnostics,[]);}
if(process.argv.includes('--check-current'))for(const i of [...object.compilerInputs,...object.results.flatMap(t=>[...t.inputs,...t.typechecks.flatMap(c=>c.inputs)]),...nested.compilerInputs,...nested.runs.flatMap(t=>[...t.inputs,...t.typecheck.inputs])])assert.equal(hash(fs.readFileSync(path.resolve(root,i.file))),i.sha256,i.file);
console.log(JSON.stringify({airRows:19,targets:2,realms:2,guardsPerTarget:9,appliedMutationsPerTarget:3,typeErrors:0,adjacentRows:33}));
