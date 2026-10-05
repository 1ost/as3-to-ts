const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),archive=path.join(__dirname,'runtime.json.gz'),pinFile=path.join(__dirname,'runtime-pin.json');
const retaining=process.argv[2]==='--retain';let packet,bytes;
if(retaining){
 assert.equal(process.argv.length,5);assert.ok(!fs.existsSync(archive));assert.ok(!fs.existsSync(pinFile));
 const reports=process.argv.slice(3).map(f=>path.resolve(f)),files=new Map(),inputs=[];
 const add=(file,sha)=>{file=path.resolve(file);const b=fs.readFileSync(file);if(sha)assert.equal(hash(b),sha,file);files.set(file,{file,sha256:hash(b),base64:b.toString('base64')});};
 const input=i=>{const file=path.resolve(root,i.file);inputs.push({...i,file});add(file,i.sha256);};
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else add(f);}};
 const evidence=[path.resolve(root,'../LayaAir-op2-shape-return-review/tests/nativeFlashOracle/shape-return'),path.resolve(root,'../LayaAir-op2-shape-return-review/tests/nativeFlashOracle/sprite-returns')];
 const runners=['native-generated-shape-return','native-generated-sprite-returns'];
 reports.forEach((file,index)=>{const r=JSON.parse(fs.readFileSync(file));r.compilerInputs.forEach(input);r.results.flatMap(t=>[...t.inputs,...t.typechecks.flatMap(c=>c.inputs)]).forEach(input);input({file:path.join(root,'tests',runners[index],'run.cjs'),sha256:r.runnerSha256});input({file:path.join(root,'tests',runners[index],'observer.ts'),sha256:r.observerSha256});input({file:path.join(root,'tests',runners[index],'guards.cjs'),sha256:r.guardsSha256});walk(path.dirname(file));walk(evidence[index]);});
 walk(path.join(__dirname,'baseline-failure'));
 packet={reports,evidence,inputs,files:[...files.values()]};bytes=z.gzipSync(JSON.stringify(packet),{level:9});
}else{bytes=fs.readFileSync(archive);const p=JSON.parse(fs.readFileSync(pinFile));assert.equal(hash(bytes),p.sha256);assert.equal(bytes.length,p.bytes);packet=JSON.parse(z.gunzipSync(bytes));assert.equal(packet.files.length,p.files);}
const files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,packet.files.length);
const read=f=>{const i=files.get(f);assert.ok(i,f);const b=Buffer.from(i.base64,'base64');assert.equal(hash(b),i.sha256,f);return b;};for(const f of files.keys())read(f);
for(const i of packet.inputs)assert.equal(hash(read(i.file)),i.sha256,i.file);
const reports=packet.reports.map(f=>JSON.parse(read(f)));
reports.forEach((r,index)=>{
 const evidence=packet.evidence[index],dir=path.join(evidence,'evidence');
 const receiptBytes=read(path.join(dir,'receipt.json')),receipt=JSON.parse(receiptBytes),pin=JSON.parse(read(path.join(evidence,'evidence-pin.json')));
 assert.equal(hash(receiptBytes),pin.receiptSha256);assert.equal(receipt.status,'passed');assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.runs,2);
 const rows=JSON.parse(read(path.join(evidence,'expected.json')));assert.equal(rows.length,index===0?20:16);

 for(const [f,h]of Object.entries(receipt.artifacts))assert.equal(hash(read(path.join(dir,f))),h,f);
 for(const n of [1,2])assert.deepEqual(JSON.parse(read(path.join(dir,'run-'+n+'/capture.json'))).state.observations,rows);
 for(const [q,s]of Object.entries(r.cohorts.subject)){assert.equal(hash(s.source),s.sourceSha256);assert.equal(hash(read(path.join(dir,'source',q.replaceAll('.','/')+'.as'))),s.sourceSha256);}
 assert.deepEqual(r.results.map(t=>t.target),['ES5','ES2015']);
 for(const t of r.results){
  assert.deepEqual(t.web.rows,rows);assert.deepEqual(t.node,t.web);assert.equal(t.compilerGuards,4);
  assert.equal(t.node.checks.length,index===0?6:4);for(const c of t.typechecks)assert.deepEqual(c.diagnostics,[]);
  assert.deepEqual(t.negatives,['remove-return-coercion']);assert.equal(t.controls.length,1);
  const m=t.controls[0];assert.equal(m.mutation,'remove-return-coercion');assert.equal(m.applied,3);
  assert.deepEqual(m.control,m.browserControl);assert.equal(m.control.failure.name,'Error');
  assert.equal(m.control.failure.message,index===0?'forged Shape rejected':'forged Sprite rejected');
 }


});
const baselineDir=path.join(__dirname,'baseline-failure'),b=JSON.parse(read(path.join(baselineDir,'failure.json')));
assert.equal(b.message,'AS3_CALLABLE_CLASS_UNSUPPORTED: generated native return type requires separate qualification');
for(const name of ['native-callable-classes'])for(const [d,e]of [['src','ts'],['lib','js']]){const f=path.join(root,d,'emit/'+name+'.'+e);assert.equal(hash(read(path.join(baselineDir,d,'emit/'+name+'.'+e))),b.compilerInputs.find(i=>i.file===f).sha256);}
if(retaining||process.argv.includes('--check-current'))for(const [f,i]of files)assert.equal(hash(fs.readFileSync(f)),i.sha256,f);
if(retaining){fs.writeFileSync(archive,bytes,{flag:'wx'});fs.writeFileSync(pinFile,JSON.stringify({sha256:hash(bytes),bytes:bytes.length,files:files.size},null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:'verified',primaryRows:20,adjacentRows:16,targets:2,realms:2,primaryGuards:4,hostGuards:6,mutationsPerTarget:1,typeErrors:0}));
module.exports={packet,reports,read};
