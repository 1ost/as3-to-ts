const fs=require('fs'),path=require('path'),z=require('zlib'),assert=require('assert/strict');
const {root,engine,hash}=require('./compile.cjs');
assert.equal(process.argv.length,6,'Pass private-return, vector-boundaries, protected-storage and nested-callback reports');
const names=['returns','boundaries','protected','nested'];
const reports=Object.fromEntries(names.map((name,i)=>[name,JSON.parse(fs.readFileSync(process.argv[i+2]))]));
const suites={returns:__dirname,boundaries:path.resolve(__dirname,'../native-generated-vector-boundaries'),protected:path.resolve(__dirname,'../native-protected-vector-storage'),nested:path.resolve(__dirname,'../native-generated-nested-anonymous')};
const inputs=new Map();
function inspect(value,suite){
 if(!value||typeof value!=='object')return;
 if(typeof value.file==='string'&&typeof value.sha256==='string'){
  const file=path.isAbsolute(value.file)?value.file:[root,suite,engine].map(dir=>path.join(dir,value.file)).find(file=>fs.existsSync(file));
  assert(file,value.file);assert.equal(hash(fs.readFileSync(file)),value.sha256,file);inputs.set(file,value.sha256);
 }
 for(const item of Object.values(value))inspect(item,suite);
}
for(const name of names)inspect(reports[name],suites[name]);
for(const name of names)for(const entry of fs.readdirSync(suites[name])){
 if(!/\.(cjs|js|ts)$/.test(entry))continue;
 const file=path.join(suites[name],entry);inputs.set(file,hash(fs.readFileSync(file)));
}
const bytes=z.gzipSync(Buffer.from(JSON.stringify({reports,inputs:[...inputs].map(([file,sha256])=>({file,sha256}))})),{level:9});
fs.writeFileSync(path.join(__dirname,'report.json.gz'),bytes);
fs.writeFileSync(path.join(__dirname,'pin.json'),JSON.stringify({sha256:hash(bytes),wholeClientQualified:false},null,2)+'\n');
