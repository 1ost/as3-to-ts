const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),z=require('zlib'),cp=require('child_process');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),root=path.resolve(__dirname,'../..'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||path.join(root,'../engine'));
const archive=path.join(__dirname,'qualified.json.gz'),pinFile=path.join(__dirname,'qualified-pin.json'),retaining=process.argv[2]==='--retain';let packet,bytes,pin;
const testNames=['native-generated-dispatcher-namespaces','native-generated-namespace-traits','native-generated-namespace-proxy-isolation','native-generated-dispatcher-script-retry'];
const inputRecords=r=>[...r.compilerInputs,...(r.runs||r.results).flatMap(v=>[...v.inputs,...(v.typecheck?v.typecheck.inputs:v.typechecks.flatMap(c=>c.inputs))])];
if(retaining){
 assert.ok(!fs.existsSync(archive));assert.ok(!fs.existsSync(pinFile));const reports=process.argv.slice(3).map(f=>path.resolve(f));assert.equal(reports.length,4);
 const files=new Map(),add=f=>{f=path.resolve(root,f);if(files.has(f))return;const b=fs.readFileSync(f);files.set(f,{file:f,sha256:hash(b),base64:b.toString('base64')});};
 const tree=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())tree(f);else add(f);}};
 for(const [index,file]of reports.entries()){const r=JSON.parse(fs.readFileSync(file));tree(path.dirname(file));for(const i of inputRecords(r)){assert.equal(hash(fs.readFileSync(path.resolve(root,i.file))),i.sha256,i.file);add(i.file);}for(const f of ['run.cjs','compile.cjs','guards.cjs','observer.ts']){const p=path.join(root,'tests',testNames[index],f);if(fs.existsSync(p))add(p);}}
 const oracleRoot=path.join(engine,'tests/nativeFlashOracle/dispatcher-namespaces');tree(oracleRoot);
 const direct=path.join(engine,'tests/nativeFlashOracle/generated-dispatcher-script-retry');tree(direct);
 const frozenOracles=[['0e85a408b7b3cfe7041ec20e938b6a58309d3dca','tests/nativeGeneratedNamespaceTraits/evidence/'],['a95bd3034b5a57493366d845b582204f1449300f','tests/nativeFlashOracle/namespaced-constructor-initializer/evidence/']].map(([commit,prefix])=>{
  const get=name=>cp.execFileSync('git',['show',commit+':'+prefix+name],{cwd:engine,maxBuffer:32*1024*1024}),receipt=get('receipt.json'),r=JSON.parse(receipt);
  return {commit,prefix,files:['receipt.json',...Object.keys(r.artifacts)].map(name=>{const b=name==='receipt.json'?receipt:get(name);return {name,sha256:hash(b),base64:b.toString('base64')};})};
 });
 // Preserve the pre-fix compiler rejection and the two implementations it used.
 add(path.join(root,'.cache/dispatcher-namespace-baseline.json'));
 const baselineSources=['src/emit/native-generated-namespaces.ts','src/emit/native-generated-proxy.ts'].map(file=>({file,source:cp.execFileSync('git',['show','b6e0c8cc54f7b2fc2aaf3da2704ee22ccb393f99:'+file],{cwd:root,encoding:'utf8'})}));
 packet={root,engine,reports,oracleRoot,direct,frozenOracles,baselineCommit:'b6e0c8cc54f7b2fc2aaf3da2704ee22ccb393f99',baselineSources,files:[...files.values()]};bytes=z.gzipSync(JSON.stringify(packet),{level:9});pin={sha256:hash(bytes),bytes:bytes.length,files:files.size};
}else{bytes=fs.readFileSync(archive);pin=JSON.parse(fs.readFileSync(pinFile));packet=JSON.parse(z.gunzipSync(bytes));}
assert.equal(hash(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);const files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,pin.files);
const read=f=>{f=path.resolve(packet.root,f);const i=files.get(f);assert.ok(i,f);const b=Buffer.from(i.base64,'base64');assert.equal(hash(b),i.sha256,f);return b;},json=f=>JSON.parse(read(f));for(const f of files.keys())read(f);
function oracle(get){const receipt=JSON.parse(get('receipt.json'));assert.equal(receipt.status,'passed');assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.runs,2);for(const [f,h]of Object.entries(receipt.artifacts))assert.equal(hash(get(f)),h,f);const a=JSON.parse(get('run-1/capture.json'));assert.deepEqual(a,JSON.parse(get('run-2/capture.json')));assert.equal(a.state.ready,true);assert.equal(a.state.failure,'');return a.state.observations;}
const original=oracle(f=>read(path.join(packet.oracleRoot,'evidence',f))),expected=oracle(f=>read(path.join(packet.oracleRoot,'qualified/evidence',f)));
assert.deepEqual(original,expected);assert.equal(expected.length,13);assert.equal(expected.at(-1).id,'native-reflection');assert.ok(!expected.at(-1).value.includes(' uri='));
const oldRows=packet.frozenOracles.map(o=>{const map=new Map(o.files.map(f=>[f.name,f]));return oracle(f=>{const i=map.get(f);assert.ok(i);const b=Buffer.from(i.base64,'base64');assert.equal(hash(b),i.sha256);return b;});});
const directRows=oracle(f=>read(path.join(packet.direct,'evidence',f))),allRows=[expected.slice(0,-1),...oldRows,directRows],reports=packet.reports.map(json);
for(const [index,r]of reports.entries()){
 const runs=r.runs||r.results;assert.deepEqual(runs.map(v=>v.target),['ES5','ES2015']);
 for(const v of runs){const actual=v.actual||v;assert.deepEqual(actual.node.rows,allRows[index]);assert.deepEqual(actual.web,actual.node);for(const c of v.typecheck?[v.typecheck]:v.typechecks)assert.deepEqual(c.diagnostics,[]);}
 for(const i of inputRecords(r))assert.equal(hash(read(i.file)),i.sha256,i.file);
 const dir=path.join(packet.root,'tests',testNames[index]);for(const i of r.runnerInputs||[])assert.equal(hash(read(path.join(dir,i.file))),i.sha256);if(r.runnerSha256)assert.equal(hash(read(path.join(dir,'run.cjs'))),r.runnerSha256);if(r.observerSha256)assert.equal(hash(read(path.join(dir,'observer.ts'))),r.observerSha256);
}
for(const [q,s]of Object.entries(reports[0].sources)){assert.equal(hash(s.source),s.sourceSha256);assert.equal(s.source,read(path.join(packet.oracleRoot,'qualified/source',q.replaceAll('.','/')+'.as')).toString());}
for(const v of reports[0].runs){assert.equal(v.guards.length,10);assert.equal(v.guards.filter(g=>g.startsWith('mutation:')).length,2);assert.equal(v.controls.length,1);const c=v.controls[0];assert.notDeepEqual(c.node.rows,allRows[0]);assert.deepEqual(c.web,c.node);const dir=path.join(path.dirname(packet.reports[0]),v.target);assert.equal(hash(read(path.join(dir,'mutation-factory.js'))),c.mutationSha256);assert.equal(hash(read(path.join(dir,'mutation-bundle.js'))),c.bundleSha256);}
const baseline=JSON.parse(read(path.join(packet.root,'.cache/dispatcher-namespace-baseline.json')).toString('utf16le').replace(/^\uFEFF/,''));assert.equal(baseline.held,true);
if(retaining||process.argv.includes('--check-current'))for(const [f,i]of files)assert.equal(hash(fs.readFileSync(f)),i.sha256,f);
if(retaining){fs.writeFileSync(archive,bytes,{flag:'wx'});fs.writeFileSync(pinFile,JSON.stringify(pin,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:'verified',rows:12,targets:2,realms:2,guards:10,compilerMutations:2,runtimeMutations:1,adjacentRows:[46,20,19],typeErrors:0,archive:pin}));module.exports={packet,reports,read};
