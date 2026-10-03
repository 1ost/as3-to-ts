const fs=require('fs'),path=require('path'),z=require('zlib'),assert=require('assert/strict');
const {root,hash}=require('./compile.cjs');
assert.equal(process.argv.length,7,'Pass nested, member, anonymous return, typed-local and DataEvent reports');
const names=['nested','members','returns','locals','data'];
const reports=Object.fromEntries(names.map((name,i)=>[name,JSON.parse(fs.readFileSync(process.argv[i+2]))]));
const suites={nested:__dirname,members:path.resolve(__dirname,'../native-generated-anonymous-members'),returns:path.resolve(__dirname,'../native-generated-anonymous-object-return'),locals:path.resolve(__dirname,'../native-generated-typed-locals'),data:path.resolve(__dirname,'../native-generated-data-event')};
const inputs=new Map();
function inspect(value,suite){
 if(!value||typeof value!=='object')return;
 if(typeof value.file==='string'&&typeof value.sha256==='string'){
  const file=path.isAbsolute(value.file)?value.file:fs.existsSync(path.join(root,value.file))?path.join(root,value.file):path.join(suite,value.file);
  assert.equal(hash(fs.readFileSync(file)),value.sha256,file);inputs.set(file,value.sha256);
 }
 for(const item of Object.values(value))inspect(item,suite);
}
for(const name of names)inspect(reports[name],suites[name]);
for(const name of names)for(const entry of fs.readdirSync(suites[name])){
 if(!/\.(cjs|ts)$/.test(entry))continue;
 const file=path.join(suites[name],entry);inputs.set(file,hash(fs.readFileSync(file)));
}
const bytes=z.gzipSync(Buffer.from(JSON.stringify({reports,inputs:[...inputs].map(([file,sha256])=>({file,sha256}))})),{level:9});
fs.writeFileSync(path.join(__dirname,'report.json.gz'),bytes);
fs.writeFileSync(path.join(__dirname,'pin.json'),JSON.stringify({sha256:hash(bytes),wholeClientQualified:false},null,2)+'\n');
