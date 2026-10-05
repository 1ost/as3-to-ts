const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const here=__dirname,root=path.resolve(here,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const archive=path.join(here,'adjacent.json.gz'),pinFile=path.join(here,'adjacent-pin.json'),retaining=process.argv[2]==='--retain';let packet,bytes;
if(retaining){
 assert.equal(process.argv.length,4);assert.ok(!fs.existsSync(archive));assert.ok(!fs.existsSync(pinFile));
 const reportFile=path.resolve(process.argv[3]),report=JSON.parse(fs.readFileSync(reportFile));
 const primary=require('./verify.cjs');const files=new Map();
 const add=(file,expected)=>{file=path.resolve(file);const b=fs.readFileSync(file);if(expected)assert.equal(hash(b),expected,file);files.set(file,{file,sha256:hash(b),base64:b.toString('base64')});};
 const inputs=[...primary.report.compilerInputs,...report.results.flatMap(r=>r.inputs)].map(i=>({...i,file:path.resolve(root,i.file)}));
 inputs.forEach(i=>add(i.file,i.sha256));
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else add(f);}};
 const evidence=path.resolve(root,'../LayaAir-op2-context-menu-clipboard-review/tests/nativeFlashOracle/sprite-owner-references');
 walk(evidence);walk(path.dirname(reportFile));for(const f of ['run.cjs','driver.ts'])add(path.join(root,'tests/native-sprite-owner-references',f));
 packet={reportFile,evidence,inputs,files:[...files.values()]};bytes=z.gzipSync(JSON.stringify(packet),{level:9});
}else{bytes=fs.readFileSync(archive);const pin=JSON.parse(fs.readFileSync(pinFile));assert.equal(hash(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);packet=JSON.parse(z.gunzipSync(bytes));assert.equal(packet.files.length,pin.files);}
const files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,packet.files.length);
const read=file=>{const i=files.get(file);assert.ok(i,file);const b=Buffer.from(i.base64,'base64');assert.equal(hash(b),i.sha256,file);return b;};for(const f of files.keys())read(f);
for(const i of packet.inputs)assert.equal(hash(read(i.file)),i.sha256,i.file);
const receiptBytes=read(path.join(packet.evidence,'evidence/receipt.json')),receipt=JSON.parse(receiptBytes);
assert.equal(hash(receiptBytes),JSON.parse(read(path.join(packet.evidence,'evidence-pin.json'))).receiptSha256);assert.equal(receipt.status,'passed');
for(const [f,h]of Object.entries(receipt.artifacts))assert.equal(hash(read(path.join(packet.evidence,'evidence',f))),h,f);
const all=JSON.parse(read(path.join(packet.evidence,'expected.json')));assert.equal(all.length,64);
for(const n of [1,2])assert.deepEqual(JSON.parse(read(path.join(packet.evidence,'evidence/run-'+n+'/capture.json'))).state.observations,all);
const expected=all.filter(r=>r.id!=='ContextMenu-base'),report=JSON.parse(read(packet.reportFile));assert.equal(expected.length,63);assert.deepEqual(report.expected,expected);
assert.equal(hash(read(path.join(packet.evidence,'source/SpriteOwnerHolder.as'))),report.sourceSha256);
assert.equal(report.bindingGuards,10);assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
for(const r of report.results){assert.deepEqual(r.types,[]);assert.deepEqual(r.node.rows,expected);assert.deepEqual(r.node,r.web);assert.equal(r.node.guards,30);}
if(retaining||process.argv.includes('--check-current'))for(const [f,i]of files)assert.equal(hash(fs.readFileSync(f)),i.sha256,f);
if(retaining){fs.writeFileSync(archive,bytes,{flag:'wx'});fs.writeFileSync(pinFile,JSON.stringify({sha256:hash(bytes),bytes:bytes.length,files:files.size},null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:'verified',rows:63,targets:2,realms:2,runtimeGuards:30,bindingGuards:10,typeErrors:0,excluded:'ContextMenu NativeMenu ancestry',limitation:'legacy harness lacks type-program input hashes'}));
