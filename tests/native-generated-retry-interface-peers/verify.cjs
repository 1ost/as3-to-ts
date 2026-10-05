const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const archive=path.join(__dirname,'runtime.json.gz'),pinFile=path.join(__dirname,'runtime-pin.json');
const retaining=process.argv[2]==='--retain';let packet,bytes;
if(retaining){
 assert.equal(process.argv.length,5);assert.ok(!fs.existsSync(archive));assert.ok(!fs.existsSync(pinFile));
 const reports=process.argv.slice(3).map(f=>path.resolve(f)),files=new Map(),inputs=[];
 const add=(file,sha)=>{file=path.resolve(file);const b=fs.readFileSync(file);if(sha)assert.equal(hash(b),sha,file);files.set(file,{file,sha256:hash(b),base64:b.toString('base64')});};
 const input=i=>{const file=path.resolve(root,i.file);inputs.push({...i,file});add(file,i.sha256);};
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else add(f);}};
 const evidence=path.resolve(root,'../op2-html5/game-client-laya/tests/derived-script-retry');
 const runners=[path.join(__dirname,'runtime.cjs'),path.join(root,'tests/native-generated-derived-script-retry/run.cjs')];
 const observer=path.join(root,'tests/native-generated-derived-script-retry/observer.ts');
 reports.forEach((file,index)=>{const r=JSON.parse(fs.readFileSync(file));r.compilerInputs.forEach(input);r.results.flatMap(t=>[...t.inputs,...t.typechecks.flatMap(c=>c.inputs)]).forEach(input);input({file:runners[index],sha256:r.runnerSha256});input({file:observer,sha256:r.observerSha256});walk(path.dirname(file));});
 walk(evidence);walk(path.join(root,'lib'));walk(path.join(root,'utils'));
 for(const f of ['run.cjs','plan-report.json','verify.cjs'])add(path.join(__dirname,f));
 const baseline=path.resolve(root,'../as3-to-ts-op2-element-format-reference-review');
 const old=require(path.join(baseline,'lib')),subject=require('./run.cjs');
 assert.throws(()=>old.createNativeGeneratedDeclarationPlan(subject.input),/Class script retries with internal declarations in their package require qualification/);
 for(const f of ['src/emit/native-generated-declarations.ts','lib/emit/native-generated-declarations.js'])add(path.join(baseline,f));
 packet={reports,evidence,runners,observer,inputs,baseline,files:[...files.values()]};bytes=z.gzipSync(JSON.stringify(packet),{level:9});
}else{bytes=fs.readFileSync(archive);const p=JSON.parse(fs.readFileSync(pinFile));assert.equal(hash(bytes),p.sha256);assert.equal(bytes.length,p.bytes);packet=JSON.parse(z.gunzipSync(bytes));assert.equal(packet.files.length,p.files);}
const files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,packet.files.length);
const read=f=>{const i=files.get(f);assert.ok(i,f);const b=Buffer.from(i.base64,'base64');assert.equal(hash(b),i.sha256,f);return b;};for(const f of files.keys())read(f);
for(const i of packet.inputs)assert.equal(hash(read(i.file)),i.sha256,i.file);
const plan=JSON.parse(read(path.join(__dirname,'plan-report.json')));
assert.equal(plan.status,'passed');assert.equal(plan.checks.length,21);
assert.equal(plan.mutation,'restored-interface-misclassification-rejected');
assert.equal(hash(read(path.join(root,'lib/emit/native-generated-declarations.js'))),plan.compilerSha256);
assert.equal(hash(read(path.join(__dirname,'run.cjs'))),plan.runnerSha256);
const receiptBytes=read(path.join(packet.evidence,'evidence/receipt.json')),receipt=JSON.parse(receiptBytes);
assert.equal(hash(receiptBytes),JSON.parse(read(path.join(packet.evidence,'evidence-pin.json'))).receiptSha256);
assert.equal(receipt.status,'passed');assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.runs,2);
for(const [f,h]of Object.entries(receipt.artifacts))assert.equal(hash(read(path.join(packet.evidence,'evidence',f))),h,f);
const rows=JSON.parse(read(path.join(packet.evidence,'expected.json')));assert.equal(rows.length,16);
for(const n of [1,2])assert.deepEqual(JSON.parse(read(path.join(packet.evidence,'evidence/run-'+n+'/capture.json'))).state.observations,rows);
const reports=packet.reports.map(f=>JSON.parse(read(f)));
reports.forEach((r,index)=>{
 assert.equal(hash(read(packet.runners[index])),r.runnerSha256);assert.equal(hash(read(packet.observer)),r.observerSha256);
 assert.deepEqual(r.results.map(t=>t.target),['ES5','ES2015']);
 for(const [q,s]of Object.entries(r.cohorts.parent)){
  assert.equal(hash(s.source),s.sourceSha256);
  if(q==='retrycases.IPeer'){assert.equal(index,0);assert.ok(s.source.includes('public interface IPeer'));}
  else assert.equal(hash(read(path.join(packet.evidence,'source',q.replaceAll('.','/')+'.as'))),s.sourceSha256);
 }
 assert.equal(Object.keys(r.cohorts.parent).length,index===0?5:4);
 for(const t of r.results){assert.deepEqual(t.web.rows,rows);assert.deepEqual(t.node,t.web);assert.equal(t.rejectionGuards,6);assert.equal(t.mutations,2);assert.equal(t.node.domainChecks.length,9);assert.ok(t.node.domainChecks.every(Boolean));for(const c of t.typechecks)assert.deepEqual(c.diagnostics,[]);}
});
if(retaining||process.argv.includes('--check-current'))for(const [f,i]of files)assert.equal(hash(fs.readFileSync(f)),i.sha256,f);
if(retaining){fs.writeFileSync(archive,bytes,{flag:'wx'});fs.writeFileSync(pinFile,JSON.stringify({sha256:hash(bytes),bytes:bytes.length,files:files.size},null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:'verified',planChecks:21,primaryRows:16,adjacentRows:16,targets:2,realms:2,typeErrors:0,files:files.size}));
module.exports={packet,reports,read};
