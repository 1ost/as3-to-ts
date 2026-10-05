const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib'),cp=require('node:child_process');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),bytes=fs.readFileSync(path.join(__dirname,'report.json.gz')),pin=require('./pin.json');
assert.equal(hash(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);const r=JSON.parse(z.gunzipSync(bytes));
assert.equal(r.sourceCount,1356);assert.equal(Object.keys(r.input.sources).length,1356);assert.equal(r.classScriptCount,95);assert.equal(r.input.classScriptSources.length,95);
assert.equal(r.emission.identity,'flashx.textLayout.elements.InlineGraphicElement');assert.equal(r.emission.status,'held');assert.equal(r.emission.phase,'emission');
assert.equal(r.emission.message,'AS3_CLASS_INITIALIZER_UNSUPPORTED: unresolved class-value identity: Capabilities');
assert.equal(r.options.nativeURLRequestReferenceModule,r.input.providers['flash.net.URLRequest'].module);
for(const s of Object.values(r.input.sources))assert.equal(hash(s.source),s.sourceSha256);
assert.equal(hash(r.input.sources[r.emission.identity].source),r.emission.sourceSha256);
assert.equal(r.input.sources[r.emission.identity].source.split('\n')[53].trim(),'private static var isMac:Boolean = Capabilities.os.search("Mac OS") > -1;');
const baseBytes=fs.readFileSync(r.baseline.file);assert.equal(hash(baseBytes),r.baseline.sha256);const packet=JSON.parse(z.gunzipSync(baseBytes));
const prior=JSON.parse(Buffer.from(packet.files.find(i=>i.file===packet.reportFile).base64,'base64'));
assert.deepEqual(r.input.sources,prior.input.sources);assert.deepEqual(r.input.classScriptSources,prior.input.classScriptSources);assert.deepEqual(r.sourceInputs,prior.sourceInputs);
const proof=require('../verify.cjs'),inputs=new Map(proof.packet.files.map(i=>[i.file,i]));
for(const i of r.compilerInputs){const frozen=inputs.get(i.file);assert.ok(frozen,i.file);assert.equal(frozen.sha256,i.sha256);assert.equal(hash(Buffer.from(frozen.base64,'base64')),i.sha256);}
const helpersBytes=fs.readFileSync(path.join(__dirname,'helpers.json.gz'));assert.equal(hash(helpersBytes),pin.helpersSha256);assert.equal(helpersBytes.length,pin.helpersBytes);
const helpers=new Map(JSON.parse(z.gunzipSync(helpersBytes)).map(i=>[i.file,i]));assert.equal(helpers.size,r.helperInputs.length);
for(const i of r.helperInputs){
 const frozen=helpers.get(i.file);assert.ok(frozen,i.file);const content=Buffer.from(frozen.base64,'base64');assert.equal(hash(content),i.sha256,i.file);
 const owner=Object.values(r.pins).find(p=>i.file.startsWith(p.checkout+path.sep));assert.ok(owner,i.file);
 const relative=path.relative(owner.checkout,i.file).replaceAll('\\','/');
 // Authenticate exact checkout bytes above, and Git's normal EOL/filter mapping
 // separately against the pinned tree. Do not pretend CRLF bytes equal LF blobs.
 const actual=cp.execFileSync('git',['hash-object','--path='+relative,'--stdin'],{cwd:owner.checkout,input:content,encoding:'utf8'}).trim();
 const expected=cp.execFileSync('git',['rev-parse',owner.commit+':'+relative],{cwd:owner.checkout,encoding:'utf8'}).trim();assert.equal(actual,expected,i.file);
}
assert.equal(hash(fs.readFileSync(path.join(__dirname,'run.cjs'))),r.tool.sha256);
for(const key of ['factory','typeCheck','runtime'])assert.equal(r[key],'not-run');assert.equal(r.providerPromotion,false);
if(process.argv.includes('--check-current'))for(const i of [...r.compilerInputs,...r.helperInputs,...r.sourceInputs,r.tool])assert.equal(hash(fs.readFileSync(i.file)),i.sha256,i.file);
console.log(JSON.stringify({status:'verified',sources:1356,classScripts:95,hold:r.emission.message,providerPromotion:false}));
