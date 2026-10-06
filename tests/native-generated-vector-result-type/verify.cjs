const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),z=require('zlib'),cp=require('child_process');
const root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),archive=path.join(__dirname,'qualified.json.gz'),pinFile=path.join(__dirname,'pin.json');
const retaining=require.main===module&&process.argv[2]==='--retain';let packet,bytes,pin;
const records=r=>[...r.compilerInputs,...(r.results||r.runs).flatMap(v=>[...(v.inputs||[]),...(v.typecheck?.inputs||[]),...(v.typechecks||[]).flatMap(t=>t.inputs)])];
if(retaining){
 assert(!fs.existsSync(archive));const [reportFile,regressionFile,staticFile,baselineFile]=process.argv.slice(3).map(f=>path.resolve(f));const files=new Map();
 const add=f=>{f=path.resolve(root,f);if(files.has(f))return;const b=fs.readFileSync(f);files.set(f,{file:f,sha256:hash(b),base64:b.toString('base64')});};
 const tree=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())tree(f);else add(f);}};
 for(const f of [reportFile,regressionFile,staticFile]){const r=JSON.parse(fs.readFileSync(f));tree(path.dirname(f));for(const i of records(r)){assert.equal(hash(fs.readFileSync(path.resolve(root,i.file))),i.sha256,i.file);add(i.file);}}
 const r=JSON.parse(fs.readFileSync(reportFile));tree(r.evidence);add(baselineFile);for(const f of ['compile.cjs','run.cjs','observer.ts','guards.cjs','README.md','verify.cjs'])add(path.join(__dirname,f));
 packet={root,reportFile,regressionFile,staticFile,baselineFile,baselineCommit:'c6f6f083d05c1b8077c87bfb7989d40bb61782f8',baselineEmitter:cp.execFileSync('git',['show','c6f6f08:src/emit/emitter.ts'],{cwd:root,encoding:'utf8'}),files:[...files.values()]};bytes=z.gzipSync(JSON.stringify(packet),{level:9});pin={sha256:hash(bytes),bytes:bytes.length,files:files.size};
}else{bytes=fs.readFileSync(archive);pin=JSON.parse(fs.readFileSync(pinFile));packet=JSON.parse(z.gunzipSync(bytes));}
assert.equal(hash(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);const files=new Map(packet.files.map(i=>[path.resolve(i.file),i]));assert.equal(files.size,pin.files);
const read=f=>{const i=files.get(path.resolve(packet.root,f));assert(i,f);const b=Buffer.from(i.base64,'base64');assert.equal(hash(b),i.sha256,f);return b;},json=f=>JSON.parse(read(f));for(const f of files.keys())read(f);
const report=json(packet.reportFile),regression=json(packet.regressionFile),storage=json(packet.staticFile),baseline=json(packet.baselineFile),receipt=json(path.join(report.evidence,'evidence/receipt.json'));
assert.equal(receipt.status,'passed');assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.identical,true);for(const [f,h]of Object.entries(receipt.artifacts)){assert.equal(hash(read(path.join(report.evidence,'evidence',f))),h);if(f.startsWith('source/'))assert.equal(hash(read(path.join(report.evidence,f))),h);}
const air=json(path.join(report.evidence,'evidence/run-1/capture.json'));assert.deepEqual(air,json(path.join(report.evidence,'evidence/run-2/capture.json')));assert.equal(air.state.failure,'');assert.equal(air.state.observations.length,13);
assert.equal(report.baseline,false);assert.deepEqual(report.results.map(v=>[v.target,v.variant]),[['ES5','source'],['ES2015','source']]);
for(const v of report.results){
 assert.deepEqual(v.diagnostics,[]);assert.deepEqual(v.node.rows,air.state.observations);assert.deepEqual(v.web,v.node);assert.equal(v.guards.length,3);assert.equal(v.controls.length,3);
 assert.deepEqual(v.controls.slice(0,2).map(c=>[c.name,c.diagnostics.map(d=>d.code)]),[['missing-result-type',[2322,2322,2322,2322]],['bare-own-class-read',[2695]]]);
 assert.equal(v.controls[2].name,'foreign-element');assert.match(v.controls[2].node.error,/vector type name differs from specialization/);assert.deepEqual(v.controls[2].web,v.controls[2].node);
 for(const [q,s]of Object.entries(v.sources)){assert.equal(hash(s.source),s.sourceSha256);assert.equal(s.source,read(path.join(report.evidence,'source',q.replaceAll('.','/')+'.as')).toString());}
}
for(const r of [report,regression,storage])for(const i of records(r))assert.equal(hash(read(i.file)),i.sha256,i.file);
assert.equal(baseline.baseline,true);for(const v of baseline.results){assert.deepEqual(v.diagnostics.map(d=>d.code).sort(),[2322,2322,2322,2322,2695]);assert.deepEqual(v.node.rows,air.state.observations);assert.deepEqual(v.node,v.web);}
assert(!packet.baselineEmitter.includes('Project that type without changing class initialization'));
assert.deepEqual(regression.runs.map(v=>v.target),['ES5','ES2015']);for(const v of regression.runs){assert.deepEqual(v.typecheck.diagnostics,[]);assert.equal(v.actual.node.rows.length,11);assert.deepEqual(v.actual.node,v.actual.web);assert.equal(v.guards.length,3);assert.equal(v.controls.length,2);}
assert.deepEqual(storage.results.map(v=>v.target),['ES5','ES2015']);for(const v of storage.results){assert.equal(v.node.rows.length,28);assert.deepEqual(v.node,v.web);assert.equal(v.mutations,2);for(const t of v.typechecks)assert.deepEqual(t.diagnostics,[]);}
if(retaining||require.main===module&&process.argv.includes('--check-current'))for(const [f,i]of files)assert.equal(hash(fs.readFileSync(f)),i.sha256,f);
if(retaining){fs.writeFileSync(archive,bytes,{flag:'wx'});fs.writeFileSync(pinFile,JSON.stringify(pin,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:'verified-vector-result-type',rows:13,targets:2,realms:2,guards:3,controls:3,typeErrors:0,filePrivateRows:11,storageRows:28,archive:pin}));module.exports={packet,read,report,regression,storage};
