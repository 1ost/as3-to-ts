const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const retaining=process.argv[2]==='--retain',candidate=process.argv.includes('--candidate');
const stem=candidate?'qualification-candidate':'qualified',archive=path.join(__dirname,stem+'.json.gz'),pinFile=path.join(__dirname,stem+'-pin.json');
let packet,bytes,pin;
if(retaining){
 assert.ok(!fs.existsSync(archive));assert.ok(!fs.existsSync(pinFile));
 const reportFile=path.resolve(process.argv[3]),report=JSON.parse(fs.readFileSync(reportFile)),files=new Map();
 const add=(file,sha)=>{const b=fs.readFileSync(file);if(sha)assert.equal(hash(b),sha,file);files.set(file,{file,sha256:hash(b),base64:b.toString('base64')});};
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else add(f);}};
 for(const i of [...report.inputs,...report.results.flatMap(r=>[...r.typeInputs,...r.bundleInputs])])add(i.file,i.sha256);
 walk(path.dirname(reportFile));const evidence=path.resolve(__dirname,'../../../engine/tests/nativeFlashOracle/mouse-class-reference');walk(evidence);
 packet={reportFile,evidence,files:[...files.values()]};bytes=z.gzipSync(JSON.stringify(packet),{level:9});pin={sha256:hash(bytes),bytes:bytes.length,files:files.size,candidate};
}else{bytes=fs.readFileSync(archive);pin=JSON.parse(fs.readFileSync(pinFile));packet=JSON.parse(z.gunzipSync(bytes));}
assert.equal(hash(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);assert.equal(pin.candidate,candidate);
const files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,pin.files);
const read=file=>{const i=files.get(file);assert.ok(i,file);const b=Buffer.from(i.base64,'base64');assert.equal(hash(b),i.sha256,file);return b;};for(const f of files.keys())read(f);
const report=JSON.parse(read(packet.reportFile));assert.equal(report.status,'passed');assert.equal(report.candidate,candidate);
const air=JSON.parse(read(path.join(packet.evidence,'evidence/run-1/capture.json')));assert.deepEqual(air,JSON.parse(read(path.join(packet.evidence,'evidence/run-2/capture.json'))));
for(const name of ['pin.json','sdk/pin.json']){const dir=path.dirname(path.join(packet.evidence,name)),p=JSON.parse(read(path.join(packet.evidence,name)));for(const [f,h]of Object.entries(p.artifacts))assert.equal(hash(read(path.join(dir,f))),h);}
assert.deepEqual(Object.keys(report.source),['mouseprobe.Reader']);const subject=report.source['mouseprobe.Reader'];assert.equal(hash(subject.source),subject.sourceSha256);assert.equal(subject.source,read(path.join(packet.evidence,'source/mouseprobe/Reader.as')).toString());
assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
const wanted=['none','auto','text','none','pointer','auto'];
for(const r of report.results){
 assert.deepEqual(r.diagnostics,[]);assert.deepEqual(r.errors,[]);assert.deepEqual(r.rows,air.state.observations.slice(0,10));
 assert.deepEqual(r.reflection.actual,r.reflection.expected);assert.equal(r.reflection.actual.attributes.name,'flash.ui::Mouse');
 assert.deepEqual(r.checks.map(c=>c.id),['same-native-class','source-class','class-is-not-instance','prototype-is-not-instance','forged-instance-is-not-instance','forged-instance-cast-is-null','undefined-cast-is-null','cursor-restored']);assert.ok(r.checks.every(c=>c.passed));
 assert.deepEqual(r.transitions,wanted);assert.deepEqual(r.controls.map(c=>c.mutation),['without-hide','without-show']);
 assert.equal(hash(read(r.factory.file)),r.factory.sha256);
 for(const c of r.controls){assert.notDeepEqual(c.actual.transitions,wanted);for(const [suffix,h]of [['bundle',c.bundleSha256],['factory',c.factorySha256]])assert.equal(hash(read(path.join(path.dirname(r.factory.file),c.mutation+'-'+suffix+'.js'))),h);}
 for(const i of [...r.typeInputs,...r.bundleInputs])assert.equal(hash(read(i.file)),i.sha256,i.file);
 for(const s of r.generatedSources)assert.equal(read(path.join(path.dirname(r.factory.file),s.module+'.ts')).toString(),s.source);
}
for(const i of report.inputs)assert.equal(hash(read(i.file)),i.sha256,i.file);
if(retaining||process.argv.includes('--check-current'))for(const [f,i]of files)assert.equal(hash(fs.readFileSync(f)),i.sha256,f);
if(retaining){fs.writeFileSync(archive,bytes,{flag:'wx'});fs.writeFileSync(pinFile,JSON.stringify(pin,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:'verified',candidate,targets:2,rows:10,reflection:'complete',hostChecks:8,mutationsPerTarget:2,typeErrors:0}));
module.exports={packet,report,read};
