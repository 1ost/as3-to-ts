const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),root=path.resolve(__dirname,'../..');
const archive=path.join(__dirname,'qualified.json.gz'),pinFile=path.join(__dirname,'qualified-pin.json'),retaining=process.argv[2]==='--retain';let packet,bytes,pin;
if(retaining){
 assert.ok(!fs.existsSync(archive));assert.ok(!fs.existsSync(pinFile));
 const reports=process.argv.slice(3).map(f=>path.resolve(f));assert.equal(reports.length,3);
 const files=new Map(),add=f=>{f=path.resolve(root,f);if(files.has(f))return;const b=fs.readFileSync(f);files.set(f,{file:f,sha256:hash(b),base64:b.toString('base64')});};
 const tree=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,entry.name);if(entry.isDirectory())tree(f);else add(f);}};
 for(const file of reports){const r=JSON.parse(fs.readFileSync(file));tree(path.dirname(file));for(const i of [...r.compilerInputs,...r.results.flatMap(v=>[...v.inputs,...v.typechecks.flatMap(c=>c.inputs)])]){assert.equal(hash(fs.readFileSync(path.resolve(root,i.file))),i.sha256,i.file);add(i.file);}}
 for(const f of ['run.cjs','observer.ts','baseline.json.gz','baseline-pin.json'])add(path.join(__dirname,f));
 const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||path.join(root,'../engine'));
 const oracles=['accessibility-script-retry','generated-accessibility','generated-dispatcher-script-retry'].map(n=>path.join(engine,'tests/nativeFlashOracle',n));for(const dir of oracles)tree(dir);
 packet={root,reports,oracles,files:[...files.values()]};bytes=z.gzipSync(JSON.stringify(packet),{level:9});pin={sha256:hash(bytes),bytes:bytes.length,files:files.size};
}else{bytes=fs.readFileSync(archive);pin=JSON.parse(fs.readFileSync(pinFile));packet=JSON.parse(z.gunzipSync(bytes));}
assert.equal(hash(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);const files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,pin.files);
const read=f=>{f=path.resolve(packet.root,f);const i=files.get(f);assert.ok(i,f);const b=Buffer.from(i.base64,'base64');assert.equal(hash(b),i.sha256,f);return b;},json=f=>JSON.parse(read(f));for(const f of files.keys())read(f);
const reports=packet.reports.map(json),expected=packet.oracles.map(dir=>{
 const receipt=json(path.join(dir,'evidence/receipt.json'));assert.equal(hash(read(path.join(dir,'evidence/receipt.json'))),json(path.join(dir,'evidence-pin.json')).receiptSha256);
 assert.equal(receipt.status,'passed');assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.runs,2);
 for(const [f,h]of Object.entries(receipt.artifacts)){assert.equal(hash(read(path.join(dir,'evidence',f))),h);if(f.startsWith('source/'))assert.equal(hash(read(path.join(dir,f))),h);}
 const capture=json(path.join(dir,'evidence/run-1/capture.json'));assert.deepEqual(capture,json(path.join(dir,'evidence/run-2/capture.json')));assert.equal(capture.state.failure,'');assert.equal(capture.state.ready,true);return capture.state.observations;
});
const normalize=rows=>rows.map(row=>row.id.startsWith('metadata-')?{...row,value:row.value.replace(/>\s+</g,'><')}:row);
for(const [index,r]of reports.entries()){
 assert.deepEqual(r.results.map(v=>v.target),['ES5','ES2015']);
 for(const [q,s]of Object.entries(r.cohorts.parent)){assert.equal(hash(s.source),s.sourceSha256);assert.equal(s.source,read(path.join(packet.oracles[index],'source',q.replaceAll('.','/')+'.as')).toString());}
 for(const v of r.results){assert.deepEqual(normalize(v.node.rows),normalize(expected[index]));assert.deepEqual(v.node,v.web);assert.equal(v.node.rows.length,[20,12,19][index]);assert.deepEqual(v.node.domainChecks,Array([10,4,9][index]).fill(true));assert.equal(v.rejectionGuards,[9,7,5][index]);assert.equal(v.mutations,[2,0,1][index]);if(index===1)assert.equal(v.node.runtimeGuards,16);for(const c of v.typechecks)assert.deepEqual(c.diagnostics,[]);}
 for(const i of [...r.compilerInputs,...r.results.flatMap(v=>[...v.inputs,...v.typechecks.flatMap(c=>c.inputs)])])assert.equal(hash(read(i.file)),i.sha256,i.file);
}
const r=reports[0],testDir=path.join(packet.root,'tests/native-generated-accessibility-script-retry');assert.equal(hash(read(path.join(testDir,'run.cjs'))),r.runnerSha256);assert.equal(hash(read(path.join(testDir,'observer.ts'))),r.observerSha256);
const baselineBytes=read(path.join(testDir,'baseline.json.gz')),baselinePin=json(path.join(testDir,'baseline-pin.json'));assert.equal(hash(baselineBytes),baselinePin.sha256);assert.equal(baselineBytes.length,baselinePin.bytes);
const baseline=JSON.parse(z.gunzipSync(baselineBytes));assert.equal(baseline.files.length,baselinePin.files);assert.equal(baseline.report.status,'held');assert.match(baseline.report.message,/non-retrying source root parent/);assert.equal(hash(baseline.runner),baseline.report.runnerSha256);assert.equal(hash(baseline.observer),baseline.report.observerSha256);assert.deepEqual(baseline.report.input.sources,r.cohorts.parent);
for(const i of baseline.report.compilerInputs){const old=baseline.files.find(f=>f.file===i.file);assert.ok(old);assert.equal(hash(Buffer.from(old.base64,'base64')),i.sha256);}
if(retaining||process.argv.includes('--check-current'))for(const [f,i]of files)assert.equal(hash(fs.readFileSync(f)),i.sha256,f);
if(retaining){fs.writeFileSync(archive,bytes,{flag:'wx'});fs.writeFileSync(pinFile,JSON.stringify(pin,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:'verified',targets:2,realms:2,retryRows:20,guards:9,domainChecks:10,mutations:2,adjacentRows:[12,19],typeErrors:0,archive:pin}));module.exports={packet,reports,read};
