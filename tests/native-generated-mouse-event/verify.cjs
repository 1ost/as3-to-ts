const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),z=require('node:zlib'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),bytes=fs.readFileSync(path.join(__dirname,'runtime.json.gz'));
assert.equal(hash(bytes),require('./runtime-pin.json').sha256);
const report=JSON.parse(z.gunzipSync(bytes));
const evidence=path.join(engine,'tests/nativeFlashOracle/generated-mouse-event');
const expected=require(path.join(evidence,'verify.cjs')).filter(r=>!r.id.endsWith('instance'));
const constructors=fs.readFileSync(path.join(engine,'tests/nativeFlashOracle/mouse-event-construction/native-air.json'));
assert.equal(hash(constructors),report.constructorEvidenceSha256);
assert.equal(expected.length,20);assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
for(const r of report.results){
 assert.deepEqual(r.web.rows,expected);assert.deepEqual(r.diagnostics,[]);assert.deepEqual(r.errors,[]);assert.equal(r.guards,13);
 assert.deepEqual(r.web.guards,['private-helper-export','private-entry-export','related-type','forged-target','forged-currentTarget']);
 assert.deepEqual(r.web.constructors,JSON.parse(constructors).capture.state.observations);
 assert.deepEqual(r.web.projection,[21,27,31,47,true,true]);assert.equal(r.artifact.generatedSources.length,4);
}
const source=fs.readFileSync(path.join(evidence,'source/mousecases/MouseFactory.as'),'utf8');
assert.deepEqual(report.sources,{'mousecases.MouseFactory':{source,sourceSha256:hash(source)}});
for(const [file,key]of [['run.cjs','runnerSha256'],['observer.ts','observerSha256']])assert.equal(hash(fs.readFileSync(path.join(__dirname,file),'utf8').replace(/\r\n/g,'\n')),report[key]);
// Compiler graph is normalized for Git checkout line endings. Runtime provider
// graphs retain raw consumed bytes and generated paths as historical evidence.
for(const row of report.compilerGraph)assert.equal(hash(fs.readFileSync(path.join(root,row.file),'utf8').replace(/\r\n/g,'\n')),row.sha256,row.file);
assert.deepEqual(require('../../lib/emit/native-mouseevent-traits').nativeMouseEventTraits,require('./generate.cjs'));
console.log(JSON.stringify({status:'passed',targets:2,rows:20,compileGuards:13,runtimeGuards:5,constructorRegressionRows:5}));
