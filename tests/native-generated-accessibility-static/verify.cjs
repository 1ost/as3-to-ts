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
 walk(path.dirname(reportFile));const evidence=path.resolve(__dirname,'../../../engine/tests/nativeFlashOracle/accessibility-static-class');walk(evidence);
 const adjacent=path.resolve(process.argv[4]),adjacentReport=JSON.parse(fs.readFileSync(adjacent));walk(path.dirname(adjacent));const engine=path.resolve(__dirname,'../../../engine');for(const i of adjacentReport.inputs)add(path.resolve(engine,i.path),i.sha256);
 packet={reportFile,evidence,adjacent,engine,files:[...files.values()]};bytes=z.gzipSync(JSON.stringify(packet),{level:9});pin={sha256:hash(bytes),bytes:bytes.length,files:files.size,candidate};
}else{bytes=fs.readFileSync(archive);pin=JSON.parse(fs.readFileSync(pinFile));packet=JSON.parse(z.gunzipSync(bytes));}
assert.equal(hash(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);assert.equal(pin.candidate,candidate);
const files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,pin.files);
const read=file=>{const i=files.get(file);assert.ok(i,file);const b=Buffer.from(i.base64,'base64');assert.equal(hash(b),i.sha256,file);return b;};for(const f of files.keys())read(f);
const report=JSON.parse(read(packet.reportFile));assert.equal(report.status,'passed');assert.equal(report.candidate,candidate);
const air=JSON.parse(read(path.join(packet.evidence,'evidence/run-1/capture.json')));assert.deepEqual(air,JSON.parse(read(path.join(packet.evidence,'evidence/run-2/capture.json'))));
for(const name of ['pin.json','sdk/pin.json']){const dir=path.dirname(path.join(packet.evidence,name)),p=JSON.parse(read(path.join(packet.evidence,name)));for(const [f,h]of Object.entries(p.artifacts))assert.equal(hash(read(path.join(dir,f))),h);}
assert.deepEqual(Object.keys(report.source),['accessstatic.Reader']);const subject=report.source['accessstatic.Reader'];assert.equal(hash(subject.source),subject.sourceSha256);assert.equal(subject.source,read(path.join(packet.evidence,'source/accessstatic/Reader.as')).toString());
assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);

for(const r of report.results){
 assert.deepEqual(r.diagnostics,[]);assert.deepEqual(r.errors,[]);assert.deepEqual(r.rows,air.state.observations.filter(v=>v.id!=='reflection'));
 assert.deepEqual(r.reflection.actual,r.reflection.expected);assert.equal(r.reflection.actual.attributes.name,'flash.accessibility::Accessibility');
 assert.deepEqual(r.checks.map(c=>c.id),['native-identity','source-class','class-not-instance','prototype-not-instance','forgery-not-instance','forgery-as-null','undefined-as-null','forged-display-rejected']);assert.ok(r.checks.every(c=>c.passed));
 assert.deepEqual(r.controls.map(c=>c.mutation),['lost-null-check','lost-coercion','active-host']);
 assert.equal(hash(read(r.factory.file)),r.factory.sha256);
 for(const c of r.controls){assert.notDeepEqual(c.actual.rows,r.rows);assert.equal(hash(read(path.join(path.dirname(r.factory.file),c.mutation+'-bundle.js'))),c.bundleSha256);}
 for(const i of [...r.typeInputs,...r.bundleInputs])assert.equal(hash(read(i.file)),i.sha256,i.file);
 for(const s of r.generatedSources)assert.equal(read(path.join(path.dirname(r.factory.file),s.module+'.ts')).toString(),s.source);
}
const receipt=JSON.parse(read(path.join(packet.evidence,'evidence/receipt.json')));assert.equal(receipt.status,'passed');assert.equal(receipt.capture.observationCount,27);for(const [f,h]of Object.entries(receipt.artifacts))assert.equal(hash(read(path.join(packet.evidence,'evidence',f))),h);
const adjacent=JSON.parse(read(packet.adjacent));assert.equal(adjacent.ok,true);assert.equal(adjacent.matched44,17);assert.equal(adjacent.newConstructorMatches,16);assert.equal(adjacent.guardCount,29);assert.equal(adjacent.held44.length,27);assert.deepEqual(adjacent.actualTypes.diagnostics,[]);assert.deepEqual(adjacent.node,adjacent.chromium);for(const i of adjacent.inputs)assert.equal(hash(read(path.resolve(packet.engine,i.path))),i.sha256);
for(const i of report.inputs)assert.equal(hash(read(i.file)),i.sha256,i.file);
if(retaining||process.argv.includes('--check-current'))for(const [f,i]of files)assert.equal(hash(fs.readFileSync(f)),i.sha256,f);
if(retaining){fs.writeFileSync(archive,bytes,{flag:'wx'});fs.writeFileSync(pinFile,JSON.stringify(pin,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:'verified',candidate,targets:2,rows:26,reflection:'complete',hostChecks:8,mutationsPerTarget:3,typeErrors:0}));
module.exports={packet,report,read};
