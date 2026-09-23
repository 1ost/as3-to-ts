const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),root=__dirname,pins=path.join(root,'capture-pins.json');
assert.equal(sha(pins),'c848628e148a108af18b206030d2a3b6dd05ec09b688ac7a978a5cd28da027dc');
for(const [name,pin]of Object.entries(JSON.parse(fs.readFileSync(pins)))){const directory=path.join(root,name),receipt=path.join(directory,'provenance.json');assert.equal(sha(receipt),pin);for(const f of JSON.parse(fs.readFileSync(receipt)).files){const relative=f.path.replaceAll('\\','/'),file=[path.join(directory,relative),path.join(directory,'sources',relative)].find(p=>fs.existsSync(p));assert(file,'missing original byte: '+relative);assert.equal(sha(file),f.sha256,relative);}}
module.exports=true;
