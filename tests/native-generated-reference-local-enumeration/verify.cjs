const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),z=require('zlib');
const root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),archive=path.join(__dirname,'qualified.json.gz'),pinFile=path.join(__dirname,'pin.json');
const retaining=require.main===module&&process.argv[2]==='--retain';let packet,bytes,pin;
const records=r=>[...r.compilerInputs,...r.results.flatMap(v=>[...(v.inputs||[]),...(v.typechecks||[]).flatMap(t=>t.inputs||[])])];
if(retaining){assert(!fs.existsSync(archive));const [reportFile,baselineFile,classFile,proxyFile]=process.argv.slice(3).map(f=>path.resolve(f)),files=new Map();
 const add=f=>{f=path.resolve(root,f);if(files.has(f))return;const b=fs.readFileSync(f);files.set(f,{file:f,sha256:hash(b),base64:b.toString('base64')});};
 const tree=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())tree(f);else add(f);}};
 const report=JSON.parse(fs.readFileSync(reportFile)),engine=path.resolve(report.evidence,'../../..');
 for(const file of [reportFile,baselineFile,classFile,proxyFile]){const r=JSON.parse(fs.readFileSync(file));tree(path.dirname(file));for(const i of records(r)){assert.equal(hash(fs.readFileSync(path.resolve(root,i.file))),i.sha256,i.file);add(i.file);}}
 const oracles=['reference-local-enumeration','reference-local-enumeration-constructed','generated-class-enumeration','proxy-property-dispatch'].map(n=>path.join(engine,'tests/nativeFlashOracle',n));for(const d of oracles)tree(d);
 for(const dir of ['native-generated-reference-local-enumeration','native-generated-class-enumeration','native-generated-proxy-dispatch'])for(const e of fs.readdirSync(path.join(root,'tests',dir))){const f=path.join(root,'tests',dir,e);if(fs.statSync(f).isFile()&&!e.endsWith('.gz')&&!e.endsWith('pin.json'))add(f);}
 const heldDirectory=path.join(root,'.cache/native-generated-reference-local-enumeration/run-2QiBeE/ES5/source');tree(heldDirectory);
 packet={root,reportFile,baselineFile,classFile,proxyFile,oracles,heldDirectory,files:[...files.values()]};bytes=z.gzipSync(JSON.stringify(packet),{level:9});pin={sha256:hash(bytes),bytes:bytes.length,files:files.size};
}else{bytes=fs.readFileSync(archive);pin=JSON.parse(fs.readFileSync(pinFile));packet=JSON.parse(z.gunzipSync(bytes));}
assert.equal(hash(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);const files=new Map(packet.files.map(i=>[path.resolve(i.file),i]));assert.equal(files.size,pin.files);
const read=f=>{const i=files.get(path.resolve(packet.root,f));assert(i,f);const b=Buffer.from(i.base64,'base64');assert.equal(hash(b),i.sha256,f);return b;},json=f=>JSON.parse(read(f));for(const f of files.keys())read(f);
const oracle=d=>{const r=json(path.join(d,'evidence/receipt.json'));assert.equal(r.status,'passed');assert.equal(r.capture.runs,2);assert.equal(r.capture.identical,true);for(const [f,h]of Object.entries(r.artifacts)){assert.equal(hash(read(path.join(d,'evidence',f))),h);if(f.startsWith('source/'))assert.equal(hash(read(path.join(d,f))),h);}const a=json(path.join(d,'evidence/run-1/capture.json'));assert.deepEqual(a,json(path.join(d,'evidence/run-2/capture.json')));assert.equal(a.state.failure,'');return a.state.observations;};
const expected=oracle(packet.oracles[1]);assert.equal(expected.length,10);assert.deepEqual(oracle(packet.oracles[0]),expected);
const report=json(packet.reportFile),baseline=json(packet.baselineFile),classReport=json(packet.classFile),proxyReport=json(packet.proxyFile);
for(const r of [report,baseline,classReport,proxyReport])for(const i of records(r))assert.equal(hash(read(i.file)),i.sha256,i.file);
assert.deepEqual(report.sources,baseline.sources);assert.equal(report.baseline,false);assert.equal(baseline.baseline,true);
for(const r of [report,baseline])assert.deepEqual(r.results.map(v=>v.target),['ES5','ES2015']);
for(const v of report.results){assert.deepEqual(v.diagnostics,[]);assert.deepEqual(v.node.rows,expected);assert.deepEqual(v.web,v.node);assert.equal(v.guards.length,3);assert.deepEqual(v.controls.map(c=>c.name),['legacy-enumeration','reference-coercion-removed']);for(const c of v.controls){assert.notDeepEqual(c.node.rows,expected);assert.deepEqual(c.web,c.node);}for(const [q,s]of Object.entries(v.sources)){assert.equal(hash(s.source),s.sourceSha256);assert.equal(s.source,read(path.join(report.evidence,'source',q.replaceAll('.','/')+'.as')).toString());}}
for(const v of baseline.results){assert.deepEqual(v.diagnostics,[]);assert.notDeepEqual(v.node.rows,expected);assert.deepEqual(v.node,v.web);assert.deepEqual(v.node.rows[0].value,[[[],9,'ok',0],[]]);}
for(const [r,index,count,guards]of [[classReport,2,9,3],[proxyReport,3,38,8]]){const air=oracle(packet.oracles[index]);assert.equal(air.length,count);assert.equal(r.results.length,2);for(const v of r.results){assert.equal(v.rejectionGuards,guards);for(const t of v.typechecks)assert.deepEqual(t.diagnostics,[]);assert.deepEqual(v.node.rows,air);assert.deepEqual(v.node,v.web);}}
assert.match(json(path.join(packet.heldDirectory,'failure.json')).error,/Unsupported source property representation/);
if(retaining||require.main===module&&process.argv.includes('--check-current'))for(const [f,i]of files)assert.equal(hash(fs.readFileSync(f)),i.sha256,f);
if(retaining){fs.writeFileSync(archive,bytes,{flag:'wx'});fs.writeFileSync(pinFile,JSON.stringify(pin,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:'verified-reference-local-enumeration',rows:10,targets:2,realms:2,guards:3,mutations:2,typeErrors:0,regressionRows:47,archive:pin}));module.exports={packet,read,report};
