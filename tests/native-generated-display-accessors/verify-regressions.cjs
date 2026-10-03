const fs=require('fs'),path=require('path'),z=require('zlib'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||path.join(root,'../LayaAir-op2-display-accessor-review'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>fs.readFileSync(path.join(__dirname,f));
const bytes=read('regressions.json.gz');assert.equal(hash(bytes),JSON.parse(read('regressions-pin.json')).sha256);const reports=JSON.parse(z.gunzipSync(bytes));
const check=inputs=>{if(process.argv.includes('--check-current'))for(const i of inputs)assert.equal(hash(fs.readFileSync(path.resolve(root,i.file))),i.sha256,i.file);};
for(const [key,folder,oracle,count]of [['string','native-generated-string-accessors','nativeGeneratedStringAccessors',23],['number','native-generated-number-accessors','nativeGeneratedNumberAccessors',36]]){
 const r=reports[key],expected=require(path.join(engine,'tests',oracle,'verify.cjs')).filter(x=>x.id!=='static-reflection-prototype');
 if(key==='distinct')expected.push(...JSON.parse(fs.readFileSync(path.join(root,'tests',folder,'writes-evidence/run-1/capture.json'))).state.observations);
 assert.equal(expected.length,count);assert.deepEqual(r.runs.map(x=>x.target),['ES5','ES2015']);
 for(const i of r.runnerInputs)assert.equal(hash(fs.readFileSync(path.join(root,'tests',folder,i.file))),i.sha256,i.file);
 for(const run of r.runs){assert.deepEqual(run.actual.node.rows,expected);assert.deepEqual(run.actual.web,run.actual.node);assert.deepEqual(run.typecheck.diagnostics,[]);assert.equal(run.guards.length,12);assert.equal(run.controls.length,2);
 for(const c of run.controls)for(const realm of [c.node,c.web]){if(key==='string'||key==='number')assert.match(realm.error,/selected parent accessor requires matching nonfinal half authority/);else assert.notDeepEqual(realm.rows.find(x=>x.id===c.failedRow),expected.find(x=>x.id===c.failedRow));}
 check([...run.inputs,...run.typecheck.inputs]);}check(r.compilerInputs);
}
const expected=require(path.join(engine,'tests/nativeFlashOracle/generated-sprite-position-overrides/verify.cjs'));
for(const key of ['sprite5','sprite2015']){const r=reports[key];assert.equal(r.status,'passed');assert.deepEqual(r.observation.rows,expected);assert.equal(r.observation.guards.length,5);assert.equal(r.mutations.length,7);assert.deepEqual(r.review.diagnostics,[]);assert.equal(r.review.compilerGuards.length,4);
 assert.equal(r.review.builderSha256,hash(fs.readFileSync(path.join(root,'tests/native-generated-sprite-position/build.mjs'))));
 check([...r.inputs,...r.review.compilerInputs,...r.review.typeInputs,...r.review.outputs,...r.review.sources]);}
console.log(JSON.stringify({stringRows:23,numberRows:36,spriteRows:21,targets:2,typeErrors:0}));
