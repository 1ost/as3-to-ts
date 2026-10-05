const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),here=__dirname,root=path.resolve(here,'../..');
const archive=path.join(here,'runtime.json.gz'),pinFile=path.join(here,'runtime-pin.json');
if(require.main===module&&process.argv[2]==='--retain'){
 assert.equal(process.argv.length,6);assert.ok(!fs.existsSync(archive),'Retain once');
 const reportFile=path.resolve(process.argv[3]),report=JSON.parse(fs.readFileSync(reportFile)),files=new Map();
 const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||path.join(root,'../LayaAir-op2-rectangle-return-review'));
 const evidence=path.join(engine,'tests/nativeFlashOracle/interface-getter-construction');
 const inputs=[...report.compilerInputs,...report.results.flatMap(r=>[...r.inputs,...r.typechecks.flatMap(t=>t.inputs)]),{file:path.join(here,'run.cjs'),sha256:report.runnerSha256},{file:path.join(here,'observer.ts'),sha256:report.observerSha256}].map(i=>({...i,file:path.resolve(root,i.file)}));
 const add=(file,expected)=>{const bytes=fs.readFileSync(file);if(expected)assert.equal(hash(bytes),expected,file);files.set(file,{file,sha256:hash(bytes),base64:bytes.toString('base64')});};
 inputs.forEach(i=>add(i.file,i.sha256));
 const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else add(file);}};
 walk(evidence);walk(path.dirname(reportFile));
 const adjacentFiles=process.argv.slice(4).map(f=>path.resolve(f));
 for(const [index,file]of adjacentFiles.entries()){
  const report=JSON.parse(fs.readFileSync(file)),name=['chained-interface','chained-interface-call'][index];walk(path.dirname(file));walk(path.join(engine,'tests/nativeFlashOracle',name));
  for(const input of [...report.compilerInputs,...report.results.flatMap(r=>[...r.inputs,...r.typechecks.flatMap(t=>t.inputs)])])add(path.resolve(root,input.file),input.sha256);
  for(const f of ['run.cjs','observer.ts'])add(path.join(root,'tests/native-generated-'+name,f),report[f==='run.cjs'?'runnerSha256':'observerSha256']);
 }
 const baselineFile=path.join(root,'.cache/native-generated-interface-getter-construction/run-cZwxhd/failure.json');add(baselineFile);

 const bytes=z.gzipSync(JSON.stringify({reportFile,adjacentFiles,baselineFile,inputs,evidence,files:[...files.values()]}),{level:9});fs.writeFileSync(archive,bytes);fs.writeFileSync(pinFile,JSON.stringify({sha256:hash(bytes),bytes:bytes.length,files:files.size},null,2)+'\n');
}
const pin=JSON.parse(fs.readFileSync(pinFile)),bytes=fs.readFileSync(archive);assert.equal(hash(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);
const packet=JSON.parse(z.gunzipSync(bytes)),files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,pin.files);
const read=file=>{const item=files.get(file);assert.ok(item,file);const bytes=Buffer.from(item.base64,'base64');assert.equal(hash(bytes),item.sha256,file);return bytes;};for(const file of files.keys())read(file);
const report=JSON.parse(read(packet.reportFile)),original=JSON.parse(read(path.join(packet.evidence,'expected.json')));assert.equal(original.length,33);
const expected=original.map(r=>r.id.startsWith('metadata-')?{...r,value:r.value.replace(/>\s+</g,'><')}:r);
const receiptBytes=read(path.join(packet.evidence,'evidence/receipt.json')),evidencePin=JSON.parse(read(path.join(packet.evidence,'evidence-pin.json')));assert.equal(hash(receiptBytes),evidencePin.receiptSha256);assert.equal(hash(receiptBytes),report.receiptSha256);
const receipt=JSON.parse(receiptBytes);assert.equal(receipt.status,'passed');assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.observationCount,33);
for(const [file,sha]of Object.entries(receipt.artifacts))assert.equal(hash(read(path.join(packet.evidence,'evidence',file))),sha,file);
for(const run of [1,2])assert.deepEqual(JSON.parse(read(path.join(packet.evidence,'evidence/run-'+run+'/capture.json'))).state.observations,original);
for(const [q,s]of Object.entries(report.cohorts.parent)){assert.equal(hash(s.source),s.sourceSha256);assert.equal(s.sourceSha256,receipt.artifacts['source/'+q.replaceAll('.','/')+'.as']);}
assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
for(const result of report.results){
 assert.deepEqual(result.web.rows,expected);assert.deepEqual(result.node,result.web);assert.equal(result.web.hostGuards,3);assert.equal(result.web.hostFailures,0);assert.deepEqual(result.web.hostErrors,['TypeError: Error #1034:','TypeError: Error #1034:','TypeError: AS3_CLASS_UNSUPPORTED: native class lacks exact source metadata']);assert.equal(result.rejectionGuards,8);assert.equal(result.mutations,3);
 assert.deepEqual(result.controls.map(c=>c.mutation),['getter-before-arguments','duplicate-getter','erase-constructor-arguments']);
 for(const c of result.controls){assert.equal(c.applied,1);assert.deepEqual(c.control,c.nodeControl);const id=c.mutation==='getter-before-arguments'?'value:0:1':'value:0:0';assert.notDeepEqual(c.control.rows.find(r=>r.id===id),expected.find(r=>r.id===id));}
 for(const t of result.typechecks)assert.deepEqual(t.diagnostics,[]);
}
const baseline=JSON.parse(read(packet.baselineFile));assert.match(baseline.message,/interface getter or namespace method construction requires separate authority/);
for(const [q,s]of Object.entries(baseline.cohorts.parent))assert.equal(s.sourceSha256,report.cohorts.parent[q].sourceSha256);
assert.equal(packet.adjacentFiles.length,2);
for(const [index,file]of packet.adjacentFiles.entries()){
 const adjacent=JSON.parse(read(file)),name=['chained-interface','chained-interface-call'][index],folder=path.join(path.dirname(packet.evidence),name);
 const rows=JSON.parse(read(path.join(folder,'expected.json'))),receiptBytes=read(path.join(folder,'evidence/receipt.json')),receipt=JSON.parse(receiptBytes);
 assert.equal(rows.length,[13,18][index]);assert.equal(hash(receiptBytes),adjacent.receiptSha256);assert.equal(hash(receiptBytes),JSON.parse(read(path.join(folder,'evidence-pin.json'))).receiptSha256);
 assert.equal(receipt.status,'passed');assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.identical,true);
 for(const [f,sha]of Object.entries(receipt.artifacts))assert.equal(hash(read(path.join(folder,'evidence',f))),sha,f);
 for(const run of [1,2])assert.deepEqual(JSON.parse(read(path.join(folder,'evidence/run-'+run+'/capture.json'))).state.observations,rows);
 for(const [q,s]of Object.entries(adjacent.cohorts.parent))assert.equal(s.sourceSha256,receipt.artifacts['source/'+q.replaceAll('.','/')+'.as']);
 assert.deepEqual(adjacent.results.map(r=>r.target),['ES5','ES2015']);
 for(const result of adjacent.results){assert.deepEqual(result.node,result.web);assert.deepEqual(result.node.rows,rows);assert.equal(result.rejectionGuards,[5,6][index]);assert.equal(result.mutations,2);for(const control of result.controls){assert.equal(control.applied,1);assert.notDeepEqual(control.control.rows,rows);}for(const check of result.typechecks)assert.deepEqual(check.diagnostics,[]);}
}
for(const i of packet.inputs)assert.equal(hash(read(i.file)),i.sha256,i.file);
if(process.argv.includes('--check-current')||process.argv[2]==='--retain')for(const file of files.keys())assert.equal(hash(fs.readFileSync(file)),files.get(file).sha256,file);
console.log(JSON.stringify({status:'verified',observations:33,targets:2,realms:2,compilerGuards:8,appliedMutations:6,adjacentRows:31,typeErrors:0}));

module.exports={packet,report,files,read};
