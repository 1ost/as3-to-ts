const assert=require('assert');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../../../op2-html5'));
const original=path.join(root,'as3-to-layaair-porting-kit/.local/native-assignment-review');
const output=path.join(__dirname,'oracle');fs.mkdirSync(output,{recursive:true});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const files=[];
for(const [source,target] of [
 ['AssignmentOracle.as','AssignmentOracle.as'],['flash.json','assignment-flash.json'],['capture.cjs','assignment-capture.cjs'],
 ['object-boundaries/ObjectAssignmentOracle.as','ObjectAssignmentOracle.as'],['object-boundaries/flash.json','object-flash.json'],
 ['object-boundaries/capture.cjs','object-capture.cjs'],['object-boundaries/provenance.json','object-provenance.json']
]){
 const raw=fs.readFileSync(path.join(original,source));fs.writeFileSync(path.join(output,target),raw);
 files.push({path:target,sha256:sha(raw)});
}
const objects=JSON.parse(fs.readFileSync(path.join(original,'object-boundaries/flash.json')));
const assignment=JSON.parse(fs.readFileSync(path.join(original,'flash.json')));
assert.equal(objects.length,162);assert.equal(assignment.length,12);
const objectProvenance=JSON.parse(fs.readFileSync(path.join(original,'object-boundaries/provenance.json')));
for(const record of objectProvenance.files)assert.equal(sha(fs.readFileSync(record.file)),record.sha256,record.file);
const receipt={schema:1,authority:'Independent reviewer actual deployed Flash26 captures; never native-generated expectations',
 files,assignment:{sourceSHA256:sha(fs.readFileSync(path.join(original,'AssignmentOracle.as'))),swfSHA256:sha(fs.readFileSync(path.join(original,'oracle.swf'))),
  flashSHA256:sha(fs.readFileSync(path.join(original,'flash.json'))),captureSHA256:sha(fs.readFileSync(path.join(original,'capture.cjs'))),
  commandHistory:'Original getter capture command transcript was not retained; source, SWF, capture script and observations are retained/hash identified.'},
 object:{provenanceSHA256:sha(fs.readFileSync(path.join(original,'object-boundaries/provenance.json'))),rows:objects.length},
 retentionScriptSHA256:sha(fs.readFileSync(__filename)),productionAdmission:false};
const raw=Buffer.from(JSON.stringify(receipt,null,2)+'\n');fs.writeFileSync(path.join(output,'receipt.json'),raw);
console.log(JSON.stringify({output,receiptSHA256:sha(raw),assignmentRows:assignment.length,objectRows:objects.length}));
