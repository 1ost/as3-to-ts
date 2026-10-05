const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),z=require('zlib'),cp=require('child_process');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),root=path.resolve(__dirname,'../..'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||path.join(root,'../engine'));
const archive=path.join(__dirname,'qualified.json.gz'),pinFile=path.join(__dirname,'qualified-pin.json'),retaining=process.argv[2]==='--retain';let packet,bytes,pin;
const names=['native-generated-file-private-vectors','native-generated-static-initializer-functions','native-generated-vector-constant-retry'];
const inputRecords=r=>[...r.compilerInputs,...(r.runs||r.results).flatMap(v=>[...v.inputs,...(v.typecheck?v.typecheck.inputs:v.typechecks.flatMap(c=>c.inputs))])];
if(retaining){
 assert.ok(!fs.existsSync(archive));assert.ok(!fs.existsSync(pinFile));const reports=process.argv.slice(3).map(f=>path.resolve(f));assert.equal(reports.length,3);
 const files=new Map(),add=f=>{f=path.resolve(root,f);if(files.has(f))return;const b=fs.readFileSync(f);files.set(f,{file:f,sha256:hash(b),base64:b.toString('base64')});};
 const tree=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())tree(f);else add(f);}};
 for(const [index,file]of reports.entries()){const r=JSON.parse(fs.readFileSync(file));tree(path.dirname(file));for(const i of inputRecords(r)){assert.equal(hash(fs.readFileSync(path.resolve(root,i.file))),i.sha256,i.file);add(i.file);}for(const f of ['run.cjs','compile.cjs','guards.cjs','observer.ts']){const p=path.join(root,'tests',names[index],f);if(fs.existsSync(p))add(p);}}
 const oracles=['file-private-vectors','static-initializer-functions','vector-constant-retry'].map(n=>path.join(engine,'tests/nativeFlashOracle',n));for(const dir of oracles)tree(dir);
 const baselineCommit='90ec3320034989e81550fdfdb11af0bd13f1fa86',baselineSource=cp.execFileSync('git',['show',baselineCommit+':src/emit/emitter.ts'],{cwd:root,encoding:'utf8'});add('.cache/file-private-vectors-baseline.json');
 packet={root,engine,reports,oracles,baselineCommit,baselineSource,files:[...files.values()]};bytes=z.gzipSync(JSON.stringify(packet),{level:9});pin={sha256:hash(bytes),bytes:bytes.length,files:files.size};
}else{bytes=fs.readFileSync(archive);pin=JSON.parse(fs.readFileSync(pinFile));packet=JSON.parse(z.gunzipSync(bytes));}
assert.equal(hash(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);const files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,pin.files);
const read=f=>{f=path.resolve(packet.root,f);const i=files.get(f);assert.ok(i,f);const b=Buffer.from(i.base64,'base64');assert.equal(hash(b),i.sha256,f);return b;},json=f=>JSON.parse(read(f));for(const f of files.keys())read(f);
const normalize=rows=>rows.filter(r=>r.id!=='native-reflection').map(r=>r.id.startsWith('metadata-')?{...r,value:r.value.replace(/>\s+</g,'><')}:r);
const expected=packet.oracles.map(dir=>{const receipt=json(path.join(dir,'evidence/receipt.json'));assert.equal(receipt.status,'passed');assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.runs,2);for(const [f,h]of Object.entries(receipt.artifacts)){assert.equal(hash(read(path.join(dir,'evidence',f))),h,f);if(f.startsWith('source/'))assert.equal(hash(read(path.join(dir,f))),h);}const a=json(path.join(dir,'evidence/run-1/capture.json'));assert.deepEqual(a,json(path.join(dir,'evidence/run-2/capture.json')));assert.equal(a.state.ready,true);assert.equal(a.state.failure,'');return normalize(a.state.observations);});
const reports=packet.reports.map(json);assert.deepEqual(expected.map(r=>r.length),[11,14,17]);
for(const [index,r]of reports.entries()){
 const runs=r.runs||r.results;assert.deepEqual(runs.map(v=>v.target),['ES5','ES2015']);
 for(const v of runs){const actual=v.actual||v;assert.deepEqual(actual.node.rows,expected[index]);assert.deepEqual(actual.web,actual.node);for(const c of v.typecheck?[v.typecheck]:v.typechecks)assert.deepEqual(c.diagnostics,[]);}
 for(const i of inputRecords(r))assert.equal(hash(read(i.file)),i.sha256,i.file);
 const dir=path.join(packet.root,'tests',names[index]);for(const i of r.runnerInputs||[])assert.equal(hash(read(path.join(dir,i.file))),i.sha256);if(r.runnerSha256)assert.equal(hash(read(path.join(dir,'run.cjs'))),r.runnerSha256);if(r.observerSha256)assert.equal(hash(read(path.join(dir,'observer.ts'))),r.observerSha256);
}
for(const [q,s]of Object.entries(reports[0].sources)){assert.equal(hash(s.source),s.sourceSha256);assert.equal(s.source,read(path.join(packet.oracles[0],'source',q.replaceAll('.','/')+'.as')).toString());}
for(const v of reports[0].runs){assert.equal(v.guards.length,3);assert.equal(v.guards.filter(g=>g.startsWith('mutation:')).length,1);assert.deepEqual(v.controls.map(c=>c.name),['foreign-element-type','missing-literal-class']);const dir=path.join(path.dirname(packet.reports[0]),v.target);for(const c of v.controls){assert.equal(c.node.errorID,c.name==='foreign-element-type'?1034:1125);assert.equal(c.web.errorID,c.node.errorID);assert.equal(hash(read(path.join(dir,c.name+'-factory.js'))),c.mutationSha256);assert.equal(hash(read(path.join(dir,c.name+'-bundle.js'))),c.bundleSha256);}}
const baseline=JSON.parse(read('.cache/file-private-vectors-baseline.json').toString('utf16le').replace(/^\uFEFF/,''));assert.equal(baseline.held,true);assert.ok(packet.baselineSource.includes('v.owner===owners[0]&&v.start===node.start'));
for(const [q,s]of Object.entries(reports[0].sources))assert.equal(baseline.input.sources[q].sourceSha256,s.sourceSha256);
const attempts=json(path.join(packet.oracles[0],'attempts.json'));for(const [folder,entries]of Object.entries(attempts))for(const [file,h]of Object.entries(entries))assert.equal(hash(read(path.join(packet.oracles[0],folder,file))),h);
if(retaining||process.argv.includes('--check-current'))for(const [f,i]of files)assert.equal(hash(fs.readFileSync(f)),i.sha256,f);
if(retaining){fs.writeFileSync(archive,bytes,{flag:'wx'});fs.writeFileSync(pinFile,JSON.stringify(pin,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:'verified',rows:11,targets:2,realms:2,guards:3,compilerMutations:1,runtimeMutations:2,adjacentRows:[14,17],typeErrors:0,archive:pin}));module.exports={packet,reports,read};
