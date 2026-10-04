const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const root=path.resolve(__dirname,'../..'),pin=require('./pin.json'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=fs.readFileSync(path.join(__dirname,'report.json.gz'));assert.equal(hash(bytes),pin.sha256);const reports=JSON.parse(z.gunzipSync(bytes));
const receipt=JSON.parse(fs.readFileSync(path.join(__dirname,'oracle/evidence/receipt.json')));assert.equal(receipt.status,'passed');assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.identical,true);
for(const [f,want]of Object.entries(receipt.artifacts))assert.equal(hash(fs.readFileSync(path.join(__dirname,'oracle/evidence',f))),want,f);
const a=JSON.parse(fs.readFileSync(path.join(__dirname,'oracle/evidence/run-1/capture.json'))),b=JSON.parse(fs.readFileSync(path.join(__dirname,'oracle/evidence/run-2/capture.json')));assert.deepEqual(a,b);assert.equal(a.state.observations.length,14);
for(const [kind,report]of Object.entries(reports)){
 assert.equal(report.runs.length,2);assert.equal(report.runs[0].actual.node.rows.length,pin.expectedRows[kind]);
 if(kind==='source')assert.deepEqual(report.runs[0].actual.node.rows,a.state.observations);
 for(const [i,run]of report.runs.entries()){
  assert.equal(run.target,['ES5','ES2015'][i]);assert.deepEqual(run.actual.node,run.actual.web);assert.equal(run.actual.node.error,undefined);assert.deepEqual(run.typecheck.diagnostics,[]);
  assert.equal(run.guards.length,kind==='source'?10:12);assert.equal(run.controls.length,2);
  for(const c of run.controls)for(const runtime of [c.node,c.web])assert.match(runtime.error,/selected parent accessor requires matching nonfinal half authority/);
  if(process.argv.includes('--check-current'))for(const row of [...run.inputs,...run.typecheck.inputs])assert.equal(hash(fs.readFileSync(row.file)),row.sha256,row.file);
 }
 if(process.argv.includes('--check-current'))for(const row of report.compilerInputs)assert.equal(hash(fs.readFileSync(path.join(root,row.file))),row.sha256,row.file);
}
for(const row of reports.source.runnerInputs)assert.equal(hash(fs.readFileSync(path.join(__dirname,row.file))),row.sha256,row.file);
console.log('Source accessor AIR: 14 rows, two targets, Node/CSP, 10 guards and two applied controls. Adjacent Object/Number: 64 rows.');
