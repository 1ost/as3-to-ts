const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),here=__dirname,root=path.resolve(here,'../..');
const archive=path.join(here,'runtime.json.gz'),pinFile=path.join(here,'runtime-pin.json');
if(require.main===module&&process.argv[2]==='--retain'){
 assert.equal(process.argv.length,5);assert.ok(!fs.existsSync(archive),'Retain once');
 const reportFile=path.resolve(process.argv[3]),report=JSON.parse(fs.readFileSync(reportFile)),files=new Map();
 const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||path.join(root,'../LayaAir-op2-rectangle-return-review'));
 const evidence=path.join(engine,'tests/nativeFlashOracle/private-instance-int-constants');
 const inputs=[...report.compilerInputs,...report.results.flatMap(r=>[...r.inputs,...r.typechecks.flatMap(t=>t.inputs)]),{file:path.join(here,'run.cjs'),sha256:report.runnerSha256},{file:path.join(here,'observer.ts'),sha256:report.observerSha256}].map(i=>({...i,file:path.resolve(root,i.file)}));
 const add=(file,expected)=>{const bytes=fs.readFileSync(file);if(expected)assert.equal(hash(bytes),expected,file);files.set(file,{file,sha256:hash(bytes),base64:bytes.toString('base64')});};
 inputs.forEach(i=>add(i.file,i.sha256));
 const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else add(file);}};
 walk(evidence);walk(path.dirname(reportFile));
 const adjacentFiles=[path.resolve(process.argv[4])],adjacent=JSON.parse(fs.readFileSync(adjacentFiles[0]));
 walk(path.dirname(adjacentFiles[0]));walk(path.join(engine,'tests/nativeFlashOracle/instance-constant-initialization'));
 for(const item of adjacent.providerGraph)add(path.resolve(engine,item.file),item.sha256);
 for(const f of ['run.cjs','runtime-driver.js'])add(path.join(root,'tests/native-generated-instance-constants',f));
 const baselineFile=path.join(root,'.cache/native-generated-private-instance-int-constants/run-Xqn6Iz/failure.json');add(baselineFile);
 const bytes=z.gzipSync(JSON.stringify({reportFile,adjacentFiles,baselineFile,inputs,evidence,files:[...files.values()]}),{level:9});fs.writeFileSync(archive,bytes);fs.writeFileSync(pinFile,JSON.stringify({sha256:hash(bytes),bytes:bytes.length,files:files.size},null,2)+'\n');
}
const pin=JSON.parse(fs.readFileSync(pinFile)),bytes=fs.readFileSync(archive);assert.equal(hash(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);
const packet=JSON.parse(z.gunzipSync(bytes)),files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,pin.files);
const read=file=>{const item=files.get(file);assert.ok(item,file);const bytes=Buffer.from(item.base64,'base64');assert.equal(hash(bytes),item.sha256,file);return bytes;};for(const file of files.keys())read(file);
const report=JSON.parse(read(packet.reportFile)),original=JSON.parse(read(path.join(packet.evidence,'expected.json')));assert.equal(original.length,16);
const expected=original.map(r=>r.id.startsWith('metadata-')?{...r,value:r.value.replace(/>\s+</g,'><')}:r);
const receiptBytes=read(path.join(packet.evidence,'evidence-final/receipt.json')),evidencePin=JSON.parse(read(path.join(packet.evidence,'evidence-pin.json')));assert.equal(hash(receiptBytes),evidencePin.receiptSha256);assert.equal(hash(receiptBytes),report.receiptSha256);
const receipt=JSON.parse(receiptBytes);assert.equal(receipt.status,'passed');assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.observationCount,16);
for(const [file,sha]of Object.entries(receipt.artifacts))assert.equal(hash(read(path.join(packet.evidence,'evidence-final',file))),sha,file);
for(const run of [1,2])assert.deepEqual(JSON.parse(read(path.join(packet.evidence,'evidence-final/run-'+run+'/capture.json'))).state.observations,original);
for(const [q,s]of Object.entries(report.cohorts.parent)){assert.equal(hash(s.source),s.sourceSha256);assert.equal(s.sourceSha256,receipt.artifacts['source/'+q.replaceAll('.','/')+'.as']);}
assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
for(const result of report.results){
 assert.deepEqual(result.web.rows,expected);assert.deepEqual(result.node,result.web);assert.equal(result.web.hostGuards,2);assert.equal(result.web.hostFailures,0);assert.equal(result.rejectionGuards,5);assert.equal(result.mutations,3);
 assert.deepEqual(result.controls.map(c=>c.mutation),['wrong-private-constant','erase-early-constant','evaluate-folded-receiver']);
 for(const c of result.controls){assert.equal(c.applied,1);assert.deepEqual(c.control,c.nodeControl);const id=c.mutation==='evaluate-folded-receiver'?'receiver-effect':'dynamic-read';assert.notDeepEqual(c.control.rows.find(r=>r.id===id),expected.find(r=>r.id===id));}
 for(const t of result.typechecks)assert.deepEqual(t.diagnostics,[]);
}
const baseline=JSON.parse(read(packet.baselineFile));assert.match(baseline.message,/lexical constant\/accessor lowering required/);
for(const [q,s]of Object.entries(baseline.cohorts.parent))assert.equal(s.sourceSha256,report.cohorts.parent[q].sourceSha256);
assert.equal(hash(Buffer.from(baseline.baselineLexical.base64,'base64')),baseline.baselineLexical.sha256);
const argv=process.argv;let previous;try{process.argv=argv.slice(0,2);previous=require('../native-generated-interface-getter-construction/verify.cjs');}finally{process.argv=argv;}assert.equal(hash(previous.read(baseline.baselineLexical.file)),baseline.baselineLexical.sha256);
assert.equal(packet.adjacentFiles.length,1);
const adjacent=JSON.parse(read(packet.adjacentFiles[0])),folder=path.join(path.dirname(packet.evidence),'instance-constant-initialization');
const adjacentReceiptBytes=read(path.join(folder,'evidence/receipt.json')),adjacentReceipt=JSON.parse(adjacentReceiptBytes);assert.equal(hash(adjacentReceiptBytes),JSON.parse(read(path.join(folder,'evidence-pin.json'))).receiptSha256);
for(const [f,sha]of Object.entries(adjacentReceipt.artifacts))assert.equal(hash(read(path.join(folder,'evidence',f))),sha,f);
const adjacentRows=JSON.parse(read(path.join(folder,'evidence/run-1/capture.json'))).state.observations;assert.deepEqual(adjacentRows,JSON.parse(read(path.join(folder,'evidence/run-2/capture.json'))).state.observations);assert.equal(adjacentRows.length,10);assert.equal(adjacent.rejectionGuards,6);assert.deepEqual(adjacent.typecheck.diagnostics,[]);
assert.equal(adjacent.results.length,2);for(const result of adjacent.results){assert.deepEqual(result.node,adjacentRows);assert.deepEqual(result.web,adjacentRows);}
for(const i of packet.inputs)assert.equal(hash(read(i.file)),i.sha256,i.file);
if(process.argv.includes('--check-current')||process.argv[2]==='--retain')for(const file of files.keys())assert.equal(hash(fs.readFileSync(file)),files.get(file).sha256,file);
console.log(JSON.stringify({status:'verified',observations:16,targets:2,realms:2,compilerGuards:5,appliedMutations:6,adjacentRows:10,typeErrors:0}));

module.exports={packet,report,files,read};
