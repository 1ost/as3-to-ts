// The compact replay retains the complete source plan and emitted declaration.
// Shared compiler bytes remain in the adjacent qualification archive, rather
// than duplicating that archive and the historical OP2 archive inside this one.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),retaining=process.argv[2]==='--retain';
const archive=path.join(__dirname,'replay-candidate.json.gz'),pinFile=path.join(__dirname,'replay-candidate-pin.json');let packet,bytes,pin;
if(retaining){
 assert.ok(!fs.existsSync(archive));assert.ok(!fs.existsSync(pinFile));const report=JSON.parse(fs.readFileSync(process.argv[3]));assert.equal(report.after.status,'emitted');
 const emitted=fs.readFileSync(report.after.file,'utf8'),tool=fs.readFileSync(path.join(__dirname,'replay.cjs'),'utf8');
 packet={report,emitted,tool};bytes=z.gzipSync(JSON.stringify(packet),{level:9});pin={sha256:hash(bytes),bytes:bytes.length,compilerEvidence:JSON.parse(fs.readFileSync(path.join(__dirname,'qualification-candidate-pin.json'))).sha256,pins:report.pins};
}else{bytes=fs.readFileSync(archive);pin=JSON.parse(fs.readFileSync(pinFile));packet=JSON.parse(z.gunzipSync(bytes));}
assert.equal(hash(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);const r=packet.report;assert.deepEqual(r.pins,pin.pins);
assert.equal(r.sourceCount,1356);assert.equal(Object.keys(r.input.sources).length,1356);assert.equal(r.classScriptCount,96);assert.equal(r.input.classScriptSources.length,96);assert.equal(r.candidate,true);assert.equal(r.productionProviderPromoted,false);
for(const u of Object.values(r.input.sources))assert.equal(hash(u.source),u.sourceSha256);
assert.equal(r.input.sources[r.identity].sourceSha256,r.sourceSha256);assert.equal(r.before.status,'held');assert.equal(r.before.message,'AS3_CLASS_INITIALIZER_UNSUPPORTED: unresolved class-value identity: Mouse');
assert.equal(r.after.status,'emitted');assert.equal(hash(packet.emitted),r.after.sha256);assert.equal(packet.emitted.length,r.after.characters);assert.deepEqual(r.after.syntaxDiagnostics,[]);
assert.equal(hash(packet.tool),r.inputs.find(i=>i.file.replaceAll('\\','/').endsWith('/native-generated-mouse-class-reference/replay.cjs')).sha256);
for(const key of ['typeCheck','factory','runtime'])assert.equal(r[key],'not-run');
const qualification=path.join(__dirname,'qualification-candidate.json.gz'),evidenceBytes=fs.readFileSync(qualification);assert.equal(hash(evidenceBytes),pin.compilerEvidence);
const evidence=JSON.parse(z.gunzipSync(evidenceBytes)),lookup=new Map(evidence.files.map(i=>[i.file.replaceAll('\\','/'),i]));let compilerInputs=0;
for(const i of r.inputs){const name=i.file.replaceAll('\\','/');if(!/\/compiler\/(src|lib|utils)\//.test(name))continue;const entry=lookup.get(name);assert.ok(entry,name);assert.equal(entry.sha256,i.sha256);assert.equal(hash(Buffer.from(entry.base64,'base64')),i.sha256);compilerInputs++;}
assert.ok(compilerInputs>200);
if(retaining||process.argv.includes('--check-current'))for(const i of r.inputs)assert.equal(hash(fs.readFileSync(i.file)),i.sha256,i.file);
if(retaining){fs.writeFileSync(archive,bytes,{flag:'wx'});fs.writeFileSync(pinFile,JSON.stringify(pin,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:'verified-emission',sources:1356,scripts:96,characters:r.after.characters,syntaxErrors:0,compilerInputs,productionProviderPromoted:false}));
