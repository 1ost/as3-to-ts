const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),here=__dirname,root=path.resolve(here,'../..');
const archive=path.join(here,'runtime.json.gz'),pinFile=path.join(here,'runtime-pin.json');
if(require.main===module&&process.argv[2]==='--retain'){
 assert.equal(process.argv.length,5);assert.ok(!fs.existsSync(archive),'Retain once');
 const reportFile=path.resolve(process.argv[3]),report=JSON.parse(fs.readFileSync(reportFile)),adjacentFile=path.resolve(process.argv[4]),adjacent=JSON.parse(fs.readFileSync(adjacentFile)),files=new Map();
 const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||path.join(root,'../LayaAir-op2-rectangle-return-review'));
 const evidence=path.join(engine,'tests/nativeFlashOracle/source-unit-derived-retry');
 const inputs=[...report.compilerInputs,...report.results.flatMap(r=>[...r.inputs,...r.typechecks.flatMap(t=>t.inputs)]),{file:path.join(here,'run.cjs'),sha256:report.runnerSha256},{file:path.join(here,'observer.ts'),sha256:report.observerSha256}].map(i=>({...i,file:path.resolve(root,i.file)}));
 const add=(file,expected)=>{const bytes=fs.readFileSync(file);if(expected)assert.equal(hash(bytes),expected,file);files.set(file,{file,sha256:hash(bytes),base64:bytes.toString('base64')});};
 inputs.forEach(i=>add(i.file,i.sha256));
 const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else add(file);}};
 walk(evidence);walk(path.dirname(reportFile));walk(path.dirname(adjacentFile));walk(path.join(engine,'tests/nativeFlashOracle/source-unit-mouse-retry'));
 const adjacentInputs=[...adjacent.compilerInputs,...adjacent.results.flatMap(r=>[...r.inputs,...r.typechecks.flatMap(t=>t.inputs)])];for(const i of adjacentInputs)add(path.resolve(root,i.file),i.sha256);
 for(const f of ['run.cjs','observer.ts'])add(path.join(root,'tests/native-generated-source-unit-mouse-retry',f),adjacent[f==='run.cjs'?'runnerSha256':'observerSha256']);
 const baseline=path.join(root,'.cache/native-generated-source-unit-derived-retry/run-tIoaYl/held.json');add(baseline);
 const bytes=z.gzipSync(JSON.stringify({reportFile,adjacentFile,baseline,inputs,evidence,files:[...files.values()]}),{level:9});fs.writeFileSync(archive,bytes);fs.writeFileSync(pinFile,JSON.stringify({sha256:hash(bytes),bytes:bytes.length,files:files.size},null,2)+'\n');
}
const pin=JSON.parse(fs.readFileSync(pinFile)),bytes=fs.readFileSync(archive);assert.equal(hash(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);
const packet=JSON.parse(z.gunzipSync(bytes)),files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,pin.files);
const read=file=>{const item=files.get(file);assert.ok(item,file);const bytes=Buffer.from(item.base64,'base64');assert.equal(hash(bytes),item.sha256,file);return bytes;};for(const file of files.keys())read(file);
const report=JSON.parse(read(packet.reportFile)),original=JSON.parse(read(path.join(packet.evidence,'expected.json')));assert.equal(original.length,62);
const expected=original.map(r=>r.id.startsWith('metadata-')?{...r,value:r.value.replace(/>\s+</g,'><')}:r);
const receiptBytes=read(path.join(packet.evidence,'evidence/receipt.json')),evidencePin=JSON.parse(read(path.join(packet.evidence,'evidence-pin.json')));assert.equal(hash(receiptBytes),evidencePin.receiptSha256);assert.equal(hash(receiptBytes),report.receiptSha256);
const receipt=JSON.parse(receiptBytes);assert.equal(receipt.status,'passed');assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.observationCount,62);
for(const [file,sha]of Object.entries(receipt.artifacts))assert.equal(hash(read(path.join(packet.evidence,'evidence',file))),sha,file);
for(const run of [1,2])assert.deepEqual(JSON.parse(read(path.join(packet.evidence,'evidence/run-'+run+'/capture.json'))).state.observations,original);
for(const [q,s]of Object.entries(report.cohorts.parent)){assert.equal(hash(s.source),s.sourceSha256);assert.equal(s.sourceSha256,receipt.artifacts['source/'+q.replaceAll('.','/')+'.as']);}
assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
for(const result of report.results){
 assert.deepEqual(result.web.rows,expected);assert.deepEqual(result.node,result.web);assert.equal(result.node.domainChecks.length,15);assert.ok(result.node.domainChecks.every(Boolean));assert.equal(result.rejectionGuards,11);
 assert.deepEqual(result.mutations.map(c=>c.name),['forget-early-helper-lookup','discard-failed-source-global','corrupt-derived-constructor-argument','erase-Function-parameter-intrinsic']);
 for(const c of result.mutations){assert.deepEqual(c.node,c.web);assert.ok(packet.files.some(f=>f.sha256===c.bundleSha256));if(c.name==='discard-failed-source-global')assert.match(c.node.error,/failed source function creation context/);else{assert.equal(c.node.error,undefined);assert.notDeepEqual(c.node.value.rows,expected);}}
 for(const check of result.typechecks)assert.deepEqual(check.diagnostics,[]);
}
const baseline=JSON.parse(read(packet.baseline));assert.match(baseline.error,/multi-declaration Class script retry .*requires qualification/);
for(const [q,s]of Object.entries(baseline.input.sources))assert.equal(s.sourceSha256,report.cohorts.parent[q].sourceSha256);
const adjacent=JSON.parse(read(packet.adjacentFile)),adjacentEvidence=path.join(path.dirname(packet.evidence),'source-unit-mouse-retry'),adjacentRows=JSON.parse(read(path.join(adjacentEvidence,'expected.json')));
const adjacentReceiptBytes=read(path.join(adjacentEvidence,'capture-qualified/receipt.json'));assert.equal(hash(adjacentReceiptBytes),JSON.parse(read(path.join(adjacentEvidence,'evidence-pin.json'))).receiptSha256);
const adjacentReceipt=JSON.parse(adjacentReceiptBytes);assert.equal(adjacentReceipt.status,'passed');assert.equal(adjacentReceipt.capture.identical,true);assert.equal(adjacentReceipt.capture.observationCount,62);
for(const [file,sha]of Object.entries(adjacentReceipt.artifacts))assert.equal(hash(read(path.join(adjacentEvidence,'capture-qualified',file))),sha,file);
for(const run of [1,2])assert.deepEqual(JSON.parse(read(path.join(adjacentEvidence,'capture-qualified/run-'+run+'/capture.json'))).state.observations,adjacentRows);
for(const [q,s]of Object.entries(adjacent.cohorts.parent))assert.equal(s.sourceSha256,adjacentReceipt.artifacts['source/'+q.replaceAll('.','/')+'.as']);
assert.deepEqual(adjacent.results.map(r=>r.target),['ES5','ES2015']);
for(const result of adjacent.results){assert.deepEqual(result.node,result.web);assert.deepEqual(result.node.rows,adjacentRows);assert.equal(result.rejectionGuards,9);assert.equal(result.mutations.length,4);for(const check of result.typechecks)assert.deepEqual(check.diagnostics,[]);}
for(const i of packet.inputs)assert.equal(hash(read(i.file)),i.sha256,i.file);
if(process.argv.includes('--check-current')||process.argv[2]==='--retain')for(const file of files.keys())assert.equal(hash(fs.readFileSync(file)),files.get(file).sha256,file);
console.log(JSON.stringify({status:'verified',observations:62,targets:2,realms:2,compilerGuards:11,domainChecks:15,appliedMutations:8,adjacentRows:62,typeErrors:0}));

module.exports={packet,report,files,read};
