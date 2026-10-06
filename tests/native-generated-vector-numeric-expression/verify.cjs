const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),z=require('zlib');
const root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),archive=path.join(__dirname,'qualified.json.gz'),pinFile=path.join(__dirname,'pin.json');
const retaining=process.argv[2]==='--retain';let packet,bytes,pin;
const records=r=>[...r.compilerInputs||[],...r.results.flatMap(v=>[...v.inputs||[],...(v.typechecks||[]).flatMap(t=>t.inputs||[])])];
if(retaining){
 assert(!fs.existsSync(archive));const reportFiles=process.argv.slice(3).map(f=>path.resolve(f)),files=new Map();assert.equal(reportFiles.length,3);
 const add=f=>{f=path.resolve(root,f);if(files.has(f))return;const b=fs.readFileSync(f);files.set(f,{file:f,sha256:hash(b),base64:b.toString('base64')});};
 const tree=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())tree(f);else add(f);}};
 for(const f of reportFiles){const r=JSON.parse(fs.readFileSync(f));tree(path.dirname(f));for(const i of records(r)){assert.equal(hash(fs.readFileSync(path.resolve(root,i.file))),i.sha256,i.file);add(i.file);}}
 const engine=path.resolve(JSON.parse(fs.readFileSync(reportFiles[0])).evidence,'../../..');
 const oracles=['vector-numeric-expression-generated','vector-numeric-index-generated','proxy-property-dispatch'].map(n=>path.join(engine,'tests/nativeFlashOracle',n));oracles.forEach(tree);
 for(const f of ['README.md','verify.cjs','run.cjs','compile.cjs','observer.ts','controls.cjs','guards.cjs'])add(path.join(__dirname,f));
 packet={root,reportFiles,oracles,files:[...files.values()]};bytes=z.gzipSync(JSON.stringify(packet),{level:9});pin={sha256:hash(bytes),bytes:bytes.length,files:files.size};
}else{bytes=fs.readFileSync(archive);pin=JSON.parse(fs.readFileSync(pinFile));packet=JSON.parse(z.gunzipSync(bytes));}
assert.equal(hash(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);const files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,pin.files);
const read=f=>{const i=files.get(path.resolve(packet.root,f));assert(i,f);const b=Buffer.from(i.base64,'base64');assert.equal(hash(b),i.sha256,f);return b;},json=f=>JSON.parse(read(f));for(const f of files.keys())read(f);
const oracle=d=>{const r=json(path.join(d,'evidence/receipt.json'));assert.equal(r.status,'passed');assert.equal(r.capture.runs,2);assert.equal(r.capture.identical,true);for(const [f,h]of Object.entries(r.artifacts)){assert.equal(hash(read(path.join(d,'evidence',f))),h);if(f.startsWith('source/'))assert.equal(hash(read(path.join(d,f))),h);}const a=json(path.join(d,'evidence/run-1/capture.json'));assert.deepEqual(a,json(path.join(d,'evidence/run-2/capture.json')));assert.equal(a.state.failure,'');return a.state.observations;};
const expected=packet.oracles.map(oracle),reports=packet.reportFiles.map(json);assert.deepEqual(expected.map(a=>a.length),[56,20,38]);
for(let i=0;i<reports.length;i++){
 const r=reports[i];for(const record of records(r))assert.equal(hash(read(record.file)),record.sha256,record.file);
 assert.deepEqual(r.results.map(v=>v.target),['ES5','ES2015']);
 for(const v of r.results){assert.deepEqual(v.node,v.web);assert.deepEqual(v.node.rows,expected[i]);assert.equal(v.node.error,undefined);for(const d of [v.diagnostics,...(v.typechecks||[]).map(t=>t.diagnostics)].filter(Boolean))assert.deepEqual(d,[]);}
}
const report=reports[0];for(const v of report.results){assert.equal(v.guards.length,3);assert.deepEqual(v.controls.map(c=>c.name),['legacy-indexing','numeric-as-named','lost-unary-prefix']);for(const c of v.controls){assert.deepEqual(c.node,c.web);assert.notDeepEqual(c.node.rows,expected[0]);}for(const [q,s]of Object.entries(v.sources)){assert.equal(hash(s.source),s.sourceSha256);assert.equal(s.source,read(path.join(report.evidence,'source',q.replaceAll('.','/')+'.as')).toString());}}
if(retaining||process.argv.includes('--check-current'))for(const [f,i]of files)assert.equal(hash(fs.readFileSync(f)),i.sha256,f);
if(retaining){fs.writeFileSync(archive,bytes,{flag:'wx'});fs.writeFileSync(pinFile,JSON.stringify(pin,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:'verified',rows:56,targets:2,realms:2,typeErrors:0,controls:3,guards:3,regressionRows:58,archive:pin}));module.exports={packet,read,report};
