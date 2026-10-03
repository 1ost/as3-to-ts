const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const names=['object','number','string','display','data','nativeNumber'];assert.equal(process.argv.length,8,'Pass Object, Number, String, Display, DataEvent and native Number report.json paths');
const reports=Object.fromEntries(names.map((name,i)=>[name,JSON.parse(fs.readFileSync(process.argv[i+2]))]));
const bytes=z.gzipSync(Buffer.from(JSON.stringify({reports})),{level:9}),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.writeFileSync(path.join(__dirname,'report.json.gz'),bytes);fs.writeFileSync(path.join(__dirname,'pin.json'),JSON.stringify({sha256:hash(bytes),engineCommit:reports.object.engineCommit},null,2)+'\n');
require('./verify.cjs');
