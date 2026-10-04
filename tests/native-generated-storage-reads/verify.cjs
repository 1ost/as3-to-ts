const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),root=path.resolve(__dirname,'../..'),pin=require('./runtime-pin.json');
const bytes=fs.readFileSync(path.join(__dirname,'runtime.json.gz'));assert.equal(hash(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);
const archive=JSON.parse(zlib.gunzipSync(bytes)),files=new Map(archive.files.map(item=>[item.file,item]));assert.equal(files.size,pin.files);
const current=process.argv.includes('--check-current');
for(const item of files.values()){assert.equal(hash(Buffer.from(item.base64,'base64')),item.sha256,item.file);if(current)assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);}
function inspect(value,reportName){if(!value||typeof value!=='object')return;if(typeof value.file==='string'&&typeof value.sha256==='string'){const retained=files.get(archive.references[reportName+'|'+value.file]);assert.ok(retained,value.file);assert.equal(retained.sha256,value.sha256,value.file);if(typeof value.source==='string')assert.equal(hash(value.source),value.sha256);}for(const item of Object.values(value))inspect(item,reportName);}
for(const [name,report]of Object.entries(archive.reports))inspect(report,name);
const receipt=require('./capture/receipt.json');assert.equal(receipt.status,'passed');
for(const [name,digest]of Object.entries(receipt.artifacts)){
 const file=path.join(__dirname,'capture',name);assert.equal(hash(fs.readFileSync(file)),digest,name);
 if(process.argv.includes('--check-index')||process.argv.includes('--check-git'))assert.equal(hash(execFileSync('git',['show',(process.argv.includes('--check-index')?':':'HEAD:')+path.relative(root,file).replaceAll('\\','/')],{cwd:root})),digest,name);
}
for(const item of archive.oracleInputs){assert.equal(files.get(item.file).sha256,item.sha256);assert.equal(receipt.inputs[item.file],item.sha256);}
const captures=[1,2].map(n=>require('./capture/run-'+n+'/capture.json'));assert.deepEqual(captures[0],captures[1]);assert.equal(captures[0].state.observations.length,18);
for(const name of ['FieldReads.as','FieldReadsProbe.as'])assert.equal(hash(fs.readFileSync(path.join(__dirname,'source',name))),receipt.artifacts['source/'+name]);
const primary=archive.reports.primary;assert.equal(primary.status,'passed');assert.equal(primary.wholeClientQualified,false);assert.equal(primary.pins.engine,pin.engine);assert.equal(primary.results.length,2);
const original=primary.inputs.find(item=>item.file.endsWith('expected.json'));const expected=JSON.parse(Buffer.from(files.get(original.file).base64,'base64')).concat(captures[0].state.observations);assert.equal(expected.length,52);
for(const result of primary.results){assert.deepEqual(result.diagnostics,[]);assert.equal(result.guardResults.length,4);assert.equal(result.variants.length,3);
 for(const variant of result.variants){assert.deepEqual(variant.errors,[]);assert.deepEqual(variant.node,variant.web);assert.equal(variant.web.length,52);
  if(!variant.mutation){assert.deepEqual(variant.web,expected);assert.deepEqual(variant.mismatches,[]);}else{assert.equal(variant.replacements,2);assert.notDeepEqual(variant.web,expected);}
  if(variant.mutation==='storage')assert.deepEqual(variant.mismatches.map(row=>row.id),['destroyed-name','destroyed-bound-call','field-null-size','field-null-explicit-size','field-null-shared','field-null-explicit-shared']);
 }
}
for(const name of ['objectProperties','sourceUnitRetry','arraySort'])for(const result of archive.reports[name].results){assert.deepEqual(result.node,result.web);assert.deepEqual(result.typechecks.flatMap(check=>check.diagnostics),[]);}
for(const result of archive.reports.arrayAccessors.runs){assert.deepEqual(result.actual.node,result.actual.web);assert.equal(result.actual.node.rows.length,22);assert.deepEqual(result.typecheck.diagnostics,[]);assert.equal(result.guards.length,12);assert.equal(result.controls.length,2);}
console.log(JSON.stringify({status:'passed',AIRRows:52,customEaseRows:34,fieldRows:18,targets:2,realms:2,controls:2,guards:4,adjacentRows:105,wholeClientQualified:false}));
module.exports=archive;
