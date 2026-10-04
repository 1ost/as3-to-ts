const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),root=path.resolve(__dirname,'../..');
const names=['primary','objectProperties','sourceUnitRetry','arraySort','arrayAccessors'];
assert.equal(process.argv.length,7,'Pass the five report.json paths in README order');
const reports={},files=new Map(),references={};let reportName;
function save(file,digest){file=path.resolve(file);const bytes=fs.readFileSync(file);if(digest)assert.equal(hash(bytes),digest,file);if(!files.has(file))files.set(file,{file,sha256:hash(bytes),base64:bytes.toString('base64')});}
function saveReference(file,digest){const selected=path.isAbsolute(file)?file:[path.resolve(file),path.join(root,'tests/native-generated-array-accessors',file)].find(candidate=>fs.existsSync(candidate)&&hash(fs.readFileSync(candidate))===digest);assert.ok(selected,file);save(selected,digest);references[reportName+'|'+file]=path.resolve(selected);}
function inspect(value){if(!value||typeof value!=='object')return;if(typeof value.file==='string'&&typeof value.sha256==='string')saveReference(value.file,value.sha256);for(const item of Object.values(value))inspect(item);}
for(const [i,name]of names.entries()){
 const file=path.resolve(process.argv[i+2]);assert.ok(file.startsWith(path.join(root,'.cache')+path.sep));
 reportName=name;reports[name]=JSON.parse(fs.readFileSync(file));inspect(reports[name]);
 // Retain the executed positive/mutated bundles and emitted modules as well
 // as the reports, including the primary compiler's fresh private build.
 const directory=path.dirname(file);for(const name of fs.readdirSync(directory,{recursive:true})){const artifact=path.join(directory,name);if(fs.statSync(artifact).isFile())save(artifact);}
}
const receipt=require('./capture/receipt.json'),oracleInputs=[];
for(const [file,sha256]of Object.entries(receipt.inputs))if(file.includes('GITHUB REPO')){save(file,sha256);oracleInputs.push({file,sha256});}
const archive=zlib.gzipSync(JSON.stringify({reports,references,oracleInputs,files:[...files.values()]}),{level:9});fs.writeFileSync(path.join(__dirname,'runtime.json.gz'),archive);
fs.writeFileSync(path.join(__dirname,'runtime-pin.json'),JSON.stringify({sha256:hash(archive),bytes:archive.length,files:files.size,rows:52,customEaseRows:34,fieldRows:18,adjacentRows:105,engine:reports.primary.pins.engine,compilerBase:reports.primary.pins.compilerBase},null,2)+'\n');
console.log(JSON.stringify({bytes:archive.length,files:files.size}));
