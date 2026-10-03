const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),rows=[];
for(const [folder,entry,subject,count]of [['oracle','NestedAnonymousProbe','NestedClosure',9],['void-oracle','VoidNestedProbe','VoidNestedClosure',7]]){
 const dir=path.join(__dirname,folder,'evidence'),receipt=JSON.parse(fs.readFileSync(path.join(dir,'receipt.json')));
 assert.equal(receipt.status,'passed');assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.observationCount,count);
 for(const [file,sha]of Object.entries(receipt.artifacts))assert.equal(hash(fs.readFileSync(path.join(dir,file))),sha,file);
 const captures=[1,2].map(n=>JSON.parse(fs.readFileSync(path.join(dir,'run-'+n+'/capture.json'))));assert.deepEqual(captures[0],captures[1]);
 for(const file of ['cases/'+subject+'.as',entry+'.as'])assert.equal(hash(fs.readFileSync(path.join(__dirname,folder,'source',file))),receipt.artifacts['source/'+file]);
 assert.equal(captures[0].state.observations.length,count);rows.push(...captures[0].state.observations);
}
if(require.main===module)console.log(JSON.stringify({rows:rows.length,runsPerFixture:2,runtime:'Harman AIR',scope:'Nested callback closure semantics only'}));
module.exports=rows;
