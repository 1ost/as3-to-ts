const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),here=__dirname;
const archive=path.join(here,'runtime.json.gz'),pinFile=path.join(here,'runtime-pin.json');
if(process.argv[2]==='--retain'){
 assert.equal(process.argv.length,4);assert.ok(!fs.existsSync(archive),'Retain once');
 const reportFile=path.resolve(process.argv[3]),report=JSON.parse(fs.readFileSync(reportFile)),dir=path.dirname(reportFile),files=new Map();
 const inputs=[...report.compilerInputs,...report.typeInputs,...report.providerGraph.map(i=>({...i,file:path.resolve(report.engine,i.file)})),report.runner,...report.observer.files.map(file=>({file,sha256:report.observer.sha256}))];
 for(const item of [...inputs,...fs.readdirSync(dir).map(name=>({file:path.join(dir,name)}))]){const bytes=fs.readFileSync(item.file);if(item.sha256)assert.equal(hash(bytes),item.sha256,item.file);files.set(item.file,{file:item.file,sha256:hash(bytes),base64:bytes.toString('base64')});}
 const evidence=here;
 const visit=dir=>{for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())visit(file);else{const bytes=fs.readFileSync(file);files.set(file,{file,sha256:hash(bytes),base64:bytes.toString('base64')});}}};for(const entry of ['source','evidence'])visit(path.join(evidence,entry));for(const entry of ['expected.json','evidence-pin.json','verify-air.cjs']){const file=path.join(evidence,entry),bytes=fs.readFileSync(file);files.set(file,{file,sha256:hash(bytes),base64:bytes.toString('base64')});}
 const bytes=z.gzipSync(JSON.stringify({reportFile,inputs,evidence,files:[...files.values()]}),{level:9});fs.writeFileSync(archive,bytes);fs.writeFileSync(pinFile,JSON.stringify({sha256:hash(bytes),bytes:bytes.length,files:files.size},null,2)+'\n');
}
const pin=JSON.parse(fs.readFileSync(pinFile)),bytes=fs.readFileSync(archive);assert.equal(hash(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);
const packet=JSON.parse(z.gunzipSync(bytes)),files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,pin.files);
const read=file=>{const item=files.get(file);assert.ok(item,file);const bytes=Buffer.from(item.base64,'base64');assert.equal(hash(bytes),item.sha256,file);return bytes;};for(const file of files.keys())read(file);
const report=JSON.parse(read(packet.reportFile)),expected=JSON.parse(read(path.join(packet.evidence,'expected.json')));assert.equal(expected.length,4);
const receiptBytes=read(path.join(packet.evidence,'evidence/receipt.json')),evidencePin=JSON.parse(read(path.join(packet.evidence,'evidence-pin.json')));assert.equal(hash(receiptBytes),evidencePin.receiptSha256);
const receipt=JSON.parse(receiptBytes);assert.equal(receipt.status,'passed');assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.observationCount,4);
for(const [file,sha]of Object.entries(receipt.artifacts))assert.equal(hash(read(path.join(packet.evidence,'evidence',file))),sha,file);
for(const run of [1,2])assert.deepEqual(JSON.parse(read(path.join(packet.evidence,'evidence/run-'+run+'/capture.json'))).state.observations,expected);
assert.deepEqual(report.results.map(r=>r.target),[1,2]);assert.equal(report.rejectionGuards,10);assert.deepEqual(report.typecheck.diagnostics,[]);
for(const result of report.results){assert.deepEqual(result.node,expected);assert.deepEqual(result.web,expected);assert.deepEqual(result.mutation.mismatches,['base','child-base','fresh']);assert.notDeepEqual(result.mutation.changed,expected);}
for(const item of packet.inputs)assert.equal(hash(read(item.file)),item.sha256,item.file);
if(process.argv.includes('--check-current')||process.argv[2]==='--retain')for(const file of files.keys())assert.equal(hash(fs.readFileSync(file)),files.get(file).sha256,file);
console.log(JSON.stringify({status:'verified',observations:4,targets:2,realms:2,guards:10,nodeMutations:2,typeErrors:0}));
