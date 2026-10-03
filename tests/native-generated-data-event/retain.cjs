const fs=require('fs'),path=require('path'),z=require('zlib'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(process.argv.length,6,'Pass DataEvent, error-reference, error-construction, ancestor-Boolean report paths');
const names=['data','references','construction','ancestors'];
const reports=Object.fromEntries(names.map((name,index)=>[name,JSON.parse(fs.readFileSync(process.argv[index+2]))]));
const inputs=[];function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,item.name);if(item.isDirectory())walk(f);else if(/.(ts|js|cjs)$/.test(f))inputs.push({file:path.relative(root,f).replaceAll('\\','/'),sha256:hash(fs.readFileSync(f))});}}
walk(path.join(root,'src'));walk(path.join(root,'utils'));walk(__dirname);
const document={reports,inputs,baseline:require('./baseline.json')},bytes=z.gzipSync(JSON.stringify(document),{level:9});
fs.writeFileSync(path.join(__dirname,'report.json.gz'),bytes);fs.writeFileSync(path.join(__dirname,'pin.json'),JSON.stringify({sha256:hash(bytes)},null,2)+'\n');require('./verify.cjs');
