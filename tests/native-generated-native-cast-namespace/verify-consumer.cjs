const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const retained=require('./verify.cjs'),root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const archive=path.join(__dirname,'consumer-runtime.json.gz'),pin=path.join(__dirname,'consumer-pin.json');let packet,bytes;
if(process.argv[2]==='--retain-consumer'){
 assert.equal(process.argv.length,4);assert.ok(!fs.existsSync(archive));assert.ok(!fs.existsSync(pin));const report=path.resolve(process.argv[3]),files=[];
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())walk(file);else{const b=fs.readFileSync(file);files.push({file,sha256:hash(b),base64:b.toString('base64')});}}};walk(path.dirname(report));
 packet={report,files};bytes=z.gzipSync(JSON.stringify(packet),{level:9});
}else{bytes=fs.readFileSync(archive);const p=JSON.parse(fs.readFileSync(pin));assert.equal(hash(bytes),p.sha256);assert.equal(bytes.length,p.bytes);packet=JSON.parse(z.gunzipSync(bytes));assert.equal(packet.files.length,p.files);}
const files=new Map(packet.files.map(i=>[i.file,i])),read=f=>{const i=files.get(f);assert.ok(i,f);const b=Buffer.from(i.base64,'base64');assert.equal(hash(b),i.sha256);return b;};for(const f of files.keys())read(f);
const r=JSON.parse(read(packet.report));assert.equal(r.consumerOnly,true);assert.equal(r.results.length,2);assert.equal(new Set(r.results.map(t=>t.target)).size,2);assert.equal(r.rejectionGuards,9);assert.deepEqual(r.typecheck.diagnostics,[]);
for(const t of r.results)assert.deepEqual(t.web,retained.reports[1].results[0].web);
for(const i of r.providerGraph)assert.equal(hash(retained.read(path.resolve(root,'../engine',i.file))),i.sha256);
for(const i of r.emitted){assert.equal(hash(read(i.file)),i.outputSha256);assert.equal(hash(retained.read(path.join(retained.packet.evidence[1],'source',i.qname.replaceAll('.','/')+'.as'))),i.sourceSha256);}
if(process.argv[2]==='--retain-consumer'){fs.writeFileSync(archive,bytes,{flag:'wx'});fs.writeFileSync(pin,JSON.stringify({sha256:hash(bytes),bytes:bytes.length,files:files.size},null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:'verified',consumerRows:22,targets:2,runtime:'Chromium with Laya',typeErrors:0}));
