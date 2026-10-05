const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const here=__dirname,root=path.resolve(here,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const archive=path.join(here,'adjacent.json.gz'),pinFile=path.join(here,'adjacent-pin.json');
const retaining=process.argv[2]==='--retain';let packet,bytes;
if(retaining){
 assert.equal(process.argv.length,5);assert.ok(!fs.existsSync(archive));assert.ok(!fs.existsSync(pinFile));
 const privateFile=path.resolve(process.argv[3]),protectedFile=path.resolve(process.argv[4]),p=JSON.parse(fs.readFileSync(privateFile)),q=JSON.parse(fs.readFileSync(protectedFile));
 const files=new Map(),inputs=[];
 const add=(file,expected)=>{file=path.resolve(file);const bytes=fs.readFileSync(file);if(expected)assert.equal(hash(bytes),expected,file);files.set(file,{file,sha256:hash(bytes),base64:bytes.toString('base64')});};
 const input=i=>{const file=path.resolve(i.file);inputs.push({...i,file});add(file,i.sha256);};
 [...p.compilerInputs,...p.typeInputs,...p.providerGraph.map(i=>({...i,file:path.resolve(p.engine,i.file)})),p.runner,...p.observer.files.map(file=>({file,sha256:p.observer.sha256}))].forEach(input);
 q.compilerInputs.map(i=>({...i,file:path.join(root,i.file)})).forEach(input);
 q.runnerInputs.map(i=>({...i,file:path.join(root,'tests/native-generated-protected-getter',i.file)})).forEach(input);
 q.runs.flatMap(r=>[...r.inputs,...r.typecheck.inputs]).forEach(input);
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else add(f);}};
 walk(path.dirname(privateFile));walk(path.dirname(protectedFile));
 const privateEvidence=path.join(root,'tests/native-generated-private-getter');for(const d of ['source','evidence'])walk(path.join(privateEvidence,d));for(const f of ['expected.json','evidence-pin.json','verify-air.cjs'])add(path.join(privateEvidence,f));
 const {frozen}=require('../native-generated-protected-getter/compile.cjs'),receipt=JSON.parse(frozen('evidence/receipt.json'));
 const protectedEvidence=Object.fromEntries(['evidence/receipt.json','native.ts',...Object.keys(receipt.artifacts).map(f=>'evidence/'+f)].map(f=>[f,frozen(f).toString('base64')]));
 packet={privateFile,protectedFile,privateEvidence,protectedEvidence,inputs,files:[...files.values()]};bytes=z.gzipSync(JSON.stringify(packet),{level:9});
}else{bytes=fs.readFileSync(archive);const pin=JSON.parse(fs.readFileSync(pinFile));assert.equal(hash(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);packet=JSON.parse(z.gunzipSync(bytes));assert.equal(packet.files.length,pin.files);}
const files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,packet.files.length);
const read=file=>{const item=files.get(file);assert.ok(item,file);const bytes=Buffer.from(item.base64,'base64');assert.equal(hash(bytes),item.sha256,file);return bytes;};for(const file of files.keys())read(file);
for(const i of packet.inputs)assert.equal(hash(read(i.file)),i.sha256,i.file);
const p=JSON.parse(read(packet.privateFile)),q=JSON.parse(read(packet.protectedFile));
const privateReceiptBytes=read(path.join(packet.privateEvidence,'evidence/receipt.json')),privateReceipt=JSON.parse(privateReceiptBytes);
assert.equal(hash(privateReceiptBytes),JSON.parse(read(path.join(packet.privateEvidence,'evidence-pin.json'))).receiptSha256);
const pr=JSON.parse(read(path.join(packet.privateEvidence,'expected.json')));assert.equal(pr.length,8);assert.equal(privateReceipt.status,'passed');
for(const [f,h]of Object.entries(privateReceipt.artifacts))assert.equal(hash(read(path.join(packet.privateEvidence,'evidence',f))),h,f);
for(const n of [1,2])assert.deepEqual(JSON.parse(read(path.join(packet.privateEvidence,'evidence/run-'+n+'/capture.json'))).state.observations,pr);
assert.equal(p.rejectionGuards,8);assert.deepEqual(p.typecheck.diagnostics,[]);assert.deepEqual(p.results.map(r=>r.target),[1,2]);
for(const r of p.results){assert.deepEqual(r.node,pr);assert.deepEqual(r.web,pr);assert.deepEqual(r.mutation.mismatches,['child-private','child-private-changed']);assert.notDeepEqual(r.mutation.changed,pr);}
const frozen=f=>{assert.ok(Object.hasOwn(packet.protectedEvidence,f),f);return Buffer.from(packet.protectedEvidence[f],'base64');};
const qr=JSON.parse(frozen('evidence/receipt.json'));assert.equal(hash(frozen('evidence/receipt.json')),q.receiptSha256);assert.equal(qr.status,'passed');assert.equal(hash(frozen('native.ts')),q.nativeProtocolSha256);
for(const [f,h]of Object.entries(qr.artifacts))assert.equal(hash(frozen('evidence/'+f)),h,f);
const expected=JSON.parse(frozen('evidence/run-1/capture.json')).state.observations;assert.equal(expected.length,19);assert.deepEqual(expected,JSON.parse(frozen('evidence/run-2/capture.json')).state.observations);
assert.deepEqual(q.runs.map(r=>r.target),['ES5','ES2015']);
for(const r of q.runs){assert.deepEqual(r.actual.node.rows,expected);assert.deepEqual(r.actual.node,r.actual.web);assert.deepEqual(r.typecheck.diagnostics,[]);assert.equal(r.guards.length,16);for(const g of r.guards)assert.match(g.error,/AS3_[A-Z_]+UNSUPPORTED/);assert.equal(r.controls.length,2);for(const c of r.controls)for(const realm of [c.node,c.web])if(c.name==='super-uses-virtual-dispatch')assert.match(realm.error||'',/call stack|recursion/i);else{assert.equal(c.name,'override-loses-negation');assert.equal(realm.error,undefined);assert.notDeepEqual(realm.rows,expected);}}
if(retaining||process.argv.includes('--check-current'))for(const [file,item]of files)assert.equal(hash(fs.readFileSync(file)),item.sha256,file);
if(retaining){fs.writeFileSync(archive,bytes,{flag:'wx'});fs.writeFileSync(pinFile,JSON.stringify({sha256:hash(bytes),bytes:bytes.length,files:files.size},null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:'verified',airRows:27,targets:2,realms:2,guards:24,typeErrors:0,privateBrowser:'legacy harness without CSP',protectedBrowser:'strict CSP'}));
