const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),z=require('node:zlib'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),pin=require('./engine.json'),engine=path.resolve(root,pin.checkout),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(cp.execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim(),pin.commit);
const bytes=fs.readFileSync(path.join(__dirname,'runtime.json.gz'));assert.equal(hash(bytes),require('./runtime-pin.json').sha256);
const {runtime:r,regressions}=JSON.parse(z.gunzipSync(bytes)),expected=require('./verify.cjs');
assert.equal(r.runnerSha256,hash(fs.readFileSync(path.join(__dirname,'run.cjs'))));assert.equal(r.observerSha256,hash(fs.readFileSync(path.join(__dirname,'observer.ts'))));
assert.deepEqual(r.results.map(t=>t.target),['ES5','ES2015']);
for(const t of r.results){assert.deepEqual(t.web.rows,expected);assert.equal(t.rejectionGuards,6);assert.equal(t.controls.length,2);for(const c of t.controls)assert.notDeepEqual(c.web.rows.find(x=>x.id===c.row),expected.find(x=>x.id===c.row));for(const c of t.typechecks)assert.deepEqual(c.diagnostics,[]);}
for(const [q,s]of Object.entries(r.cohorts.parent))assert.equal(hash(fs.readFileSync(path.join(__dirname,'source',q.replaceAll('.','/')+'.as'))),s.sourceSha256);
const baseline=require('./baseline-pin.json');for(const [file,sha]of Object.entries(baseline.files))assert.equal(hash(fs.readFileSync(path.join(__dirname,file))),sha);
assert.deepEqual(fs.readFileSync(path.join(__dirname,'baseline.log'),'utf16le').replace(/^\ufeff/,'').trim().split(/\r?\n/).map(s=>JSON.parse(s)),[{target:'ES5',baseline:true},{target:'ES2015',baseline:true}]);
if(process.argv.includes('--check-current'))for(const i of [...r.compilerInputs,...r.results.flatMap(t=>[...t.inputs,...t.typechecks.flatMap(c=>c.inputs)])])assert.equal(hash(fs.readFileSync(path.resolve(root,i.file))),i.sha256,i.file);
for(const [name,report]of Object.entries(regressions)){
 const dir=path.join(root,'tests/native-generated-'+name),rows=require(name==='chained-references'?path.join(dir,'verify.cjs'):path.join(engine,'tests/nativeFlashOracle',name,'verify.cjs'));
 assert.equal(report.runnerSha256,hash(fs.readFileSync(path.join(dir,'run.cjs'))));assert.equal(report.observerSha256,hash(fs.readFileSync(path.join(dir,'observer.ts'))));
 assert.deepEqual(report.results.map(t=>t.target),['ES5','ES2015']);
 for(const t of report.results){assert.deepEqual(t.node,t.web);assert.deepEqual(t.web.rows,rows);assert(t.rejectionGuards>0);for(const c of t.typechecks)assert.deepEqual(c.diagnostics,[]);}
 if(process.argv.includes('--check-current'))for(const i of [...(report.compilerInputs||[]),...report.results.flatMap(t=>t.typechecks.flatMap(c=>c.inputs||[]))])assert.equal(hash(fs.readFileSync(path.resolve(root,i.file))),i.sha256,i.file);
}
console.log(JSON.stringify({airRows:8,targets:2,realms:['CSP Chromium with Laya'],typeErrors:0,guardsPerTarget:6,mutationsPerTarget:2,adjacentAirRows:24}));
