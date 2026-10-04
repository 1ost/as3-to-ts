const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),here=__dirname,root=path.resolve(here,'../..');
const archive=path.join(here,'runtime.json.gz'),pinFile=path.join(here,'runtime-pin.json');
if(process.argv[2]==='--retain'){
 assert.equal(process.argv.length,4);assert.ok(!fs.existsSync(archive),'Retain once');
 const reportFile=path.resolve(process.argv[3]),report=JSON.parse(fs.readFileSync(reportFile)),files=new Map();
 const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||path.join(root,'../LayaAir-op2-namespace-namesake-review'));
 const evidence=path.join(engine,'tests/nativeFlashOracle/namespace-namesake');
 const inputs=[...report.compilerInputs,...report.results.flatMap(r=>[...r.inputs,...r.typechecks.flatMap(t=>t.inputs)]),{file:path.join(here,'run.cjs'),sha256:report.runnerSha256},{file:path.join(here,'observer.ts'),sha256:report.observerSha256}].map(i=>({...i,file:path.resolve(root,i.file)}));
 const add=(file,expected)=>{const bytes=fs.readFileSync(file);if(expected)assert.equal(hash(bytes),expected,file);files.set(file,{file,sha256:hash(bytes),base64:bytes.toString('base64')});};
 inputs.forEach(i=>add(i.file,i.sha256));
 const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else add(file);}};
 walk(evidence);walk(path.dirname(reportFile));
 const bytes=z.gzipSync(JSON.stringify({reportFile,inputs,evidence,files:[...files.values()]}),{level:9});fs.writeFileSync(archive,bytes);fs.writeFileSync(pinFile,JSON.stringify({sha256:hash(bytes),bytes:bytes.length,files:files.size},null,2)+'\n');
}
const pin=JSON.parse(fs.readFileSync(pinFile)),bytes=fs.readFileSync(archive);assert.equal(hash(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);
const packet=JSON.parse(z.gunzipSync(bytes)),files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,pin.files);
const read=file=>{const item=files.get(file);assert.ok(item,file);const bytes=Buffer.from(item.base64,'base64');assert.equal(hash(bytes),item.sha256,file);return bytes;};for(const file of files.keys())read(file);
const report=JSON.parse(read(packet.reportFile)),original=JSON.parse(read(path.join(packet.evidence,'expected.json')));assert.equal(original.length,16);
const expected=original.map(r=>r.id.startsWith('metadata-')?{...r,value:r.value.replace(/>\s+</g,'><')}:r);
const receiptBytes=read(path.join(packet.evidence,'evidence/receipt.json')),evidencePin=JSON.parse(read(path.join(packet.evidence,'evidence-pin.json')));assert.equal(hash(receiptBytes),evidencePin.receiptSha256);assert.equal(hash(receiptBytes),report.receiptSha256);
const receipt=JSON.parse(receiptBytes);assert.equal(receipt.status,'passed');assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.observationCount,16);
for(const [file,sha]of Object.entries(receipt.artifacts))assert.equal(hash(read(path.join(packet.evidence,'evidence',file))),sha,file);
for(const run of [1,2])assert.deepEqual(JSON.parse(read(path.join(packet.evidence,'evidence/run-'+run+'/capture.json'))).state.observations,original);
for(const [q,s]of Object.entries(report.cohorts.parent)){assert.equal(hash(s.source),s.sourceSha256);assert.equal(s.sourceSha256,receipt.artifacts['source/'+q.replaceAll('.','/')+'.as']);}
assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
for(const result of report.results){assert.deepEqual(result.node.rows,expected);assert.deepEqual(result.web,result.node);assert.equal(result.node.hostGuards,4);assert.equal(result.rejectionGuards,7);assert.equal(result.mutations,2);assert.deepEqual(result.controls.map(c=>c.mutation),['wrong-method','repeat-receiver']);for(const c of result.controls){assert.equal(c.applied,1);assert.notDeepEqual(c.control.rows.slice(0,5),expected.slice(0,5));}for(const t of result.typechecks)assert.deepEqual(t.diagnostics,[]);}
for(const i of packet.inputs)assert.equal(hash(read(i.file)),i.sha256,i.file);
if(process.argv.includes('--check-current')||process.argv[2]==='--retain')for(const file of files.keys())assert.equal(hash(fs.readFileSync(file)),files.get(file).sha256,file);
console.log(JSON.stringify({status:'verified',observations:16,targets:2,realms:2,compilerGuards:7,appliedMutations:4,typeErrors:0}));
