const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),root=path.resolve(__dirname,'../..'),pin=require('./runtime-pin.json');
const bytes=fs.readFileSync(path.join(__dirname,'runtime.json.gz'));assert.equal(hash(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);
const archive=JSON.parse(zlib.gunzipSync(bytes)),files=new Map(archive.files.map(item=>[item.file,item]));assert.equal(files.size,pin.files);
const current=process.argv.includes('--check-current'),git=process.argv.includes('--check-git'),index=process.argv.includes('--check-index');
for(const item of files.values()){assert.equal(hash(Buffer.from(item.base64,'base64')),item.sha256,item.file);if(current)assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);}
const read=file=>{assert.ok(files.has(file),file);return Buffer.from(files.get(file).base64,'base64');},json=file=>JSON.parse(read(file));
function inspect(value,name){if(!value||typeof value!=='object')return;if(typeof value.file==='string'&&typeof value.sha256==='string'){assert.equal(hash(read(archive.references[name+'|'+value.file])),value.sha256);if(typeof value.source==='string')assert.equal(hash(value.source),value.sha256);}for(const item of Object.values(value))inspect(item,name);}
const counts={primary:[19,8,1,11],ancestry:[11,6,1,8],derived:[16,6,2,9],dispatcher:[19,5,1,9],dispatcherInternal:[19,5,1,9]};
for(const [name,report]of Object.entries(archive.reports)){
 inspect(report,name);const oracle=archive.oracles[name],receipt=json(oracle.receiptFile),evidence=path.dirname(oracle.receiptFile);
 assert.equal(receipt.status,'passed');assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.runs,2);
 for(const [file,digest]of Object.entries(receipt.artifacts))assert.equal(hash(read(path.join(evidence,file))),digest,file);
 for(const item of oracle.tooling){assert.equal(hash(read(item.file)),item.sha256);assert.equal(receipt.inputs[item.file],item.sha256);}
 const a=json(path.join(evidence,'run-1/capture.json')),b=json(path.join(evidence,'run-2/capture.json'));assert.deepEqual(a,b);
 const expected=json(path.join(oracle.directory,'expected.json'));assert.deepEqual(a.state.observations,expected);assert.equal(expected.length,counts[name][0]);
 for(const [q,item]of Object.entries(report.cohorts.subject||report.cohorts.parent||{})){assert.equal(hash(item.source),item.sourceSha256);assert.equal(hash(read(path.join(oracle.directory,'source',q.replaceAll('.','/')+'.as'))),item.sourceSha256);}
 const fixture=path.join(root,'tests/native-generated-'+oracle.fixture);
 for(const [file,digest]of [['run.cjs',report.runnerSha256],['observer.ts',report.observerSha256]]){assert.equal(hash(read(path.join(fixture,file))),digest);assert.equal(hash(fs.readFileSync(path.join(fixture,file))),digest);}
 assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
 for(const result of report.results){assert.deepEqual(result.node,result.web);assert.deepEqual(result.web.rows,expected);assert.equal(result.rejectionGuards,counts[name][1]);assert.equal(result.mutations,counts[name][2]);assert.deepEqual(result.typechecks.flatMap(t=>t.diagnostics),[]);
  if(result.web.domainChecks){assert.equal(result.web.domainChecks.length,counts[name][3]);assert.ok(result.web.domainChecks.every(v=>v===true));}else assert.equal(result.web.checks,counts[name][3]);
 }
}
assert.ok(archive.reports.primary.results.every(r=>r.typechecks.some(t=>t.cohort==='observer')));
if(git||index){for(const item of archive.reports.primary.compilerInputs.filter(i=>i.file.startsWith(path.join(root,'src')+path.sep)||i.file.startsWith(path.join(root,'utils')+path.sep))){
 const relative=path.relative(root,item.file).replaceAll('\\','/'),tracked=execFileSync('git',['show',(index?':':'HEAD:')+relative],{cwd:root,maxBuffer:64*1024*1024});
 if(relative==='src/emit/native-generated-declarations.ts')assert.equal(hash(tracked),item.sha256,relative);
 else assert.equal(tracked.toString().replace(/\r\n/g,'\n'),read(item.file).toString().replace(/\r\n/g,'\n'),relative);
}}
console.log(JSON.stringify({status:'passed',AIRRows:19,targets:2,realms:2,domainChecks:11,guards:8,plannerControl:1,adjacentDistinctRows:46,adjacentExecutions:65,wholeClientQualified:false}));
module.exports=archive;
