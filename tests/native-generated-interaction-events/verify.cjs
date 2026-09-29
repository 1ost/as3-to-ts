const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),z=require('node:zlib'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),bytes=fs.readFileSync(path.join(__dirname,'runtime.json.gz'));
assert.equal(hash(bytes),require('./runtime-pin.json').sha256);
const report=JSON.parse(z.gunzipSync(bytes));
const evidence=path.join(engine,'tests/nativeFlashOracle/generated-interaction-event-references');
const expected=require(path.join(evidence,'verify.cjs'));
assert.equal(expected.length,201);assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
for(const r of report.results){
 assert.deepEqual(r.web.rows,expected);assert.deepEqual(r.diagnostics,[]);assert.deepEqual(r.errors,[]);assert.equal(r.guards,8);
 assert.equal(r.web.guards.length,20);
 assert.equal(r.artifact.generatedSources.length,3);
}
const sources={};for(const q of ['eventcases.InteractionHandler','flashx.textLayout.edit.IInteractionEventHandler']){const source=fs.readFileSync(path.join(evidence,'source',q.replaceAll('.','/')+'.as'),'utf8');sources[q]={source,sourceSha256:hash(source)};}assert.deepEqual(report.sources,sources);
for(const [file,key]of [['run.cjs','runnerSha256'],['observer.ts','observerSha256']])assert.equal(hash(fs.readFileSync(path.join(__dirname,file),'utf8').replace(/\r\n/g,'\n')),report[key]);
// Compiler graph is normalized for Git checkout line endings. Runtime provider
// graphs retain raw consumed bytes and generated paths as historical evidence.
for(const row of report.compilerGraph)assert.equal(hash(fs.readFileSync(path.join(root,row.file),'utf8').replace(/\r\n/g,'\n')),row.sha256,row.file);
console.log(JSON.stringify({status:'passed',targets:2,rows:201,compileGuards:8,runtimeGuards:20}));
