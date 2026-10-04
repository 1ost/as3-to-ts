const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),root=path.resolve(__dirname,'../..'),engine=path.resolve('../LayaAir-op2-public-function-review');
assert.equal(process.argv.length,6,'Pass primary, source-accessors, object-field-calls and lexical-functions reports');
const names=['primary','accessors','objectCalls','lexical'],reports={},files=new Map(),references={};let name;
function save(file,digest){file=path.resolve(file);const bytes=fs.readFileSync(file);if(digest)assert.equal(hash(bytes),digest,file);if(!files.has(file))files.set(file,{file,sha256:hash(bytes),base64:bytes.toString('base64')});return file;}
function tree(dir){for(const file of fs.readdirSync(dir,{recursive:true})){const full=path.join(dir,file);if(fs.statSync(full).isFile())save(full);}}
function inspect(value){if(!value||typeof value!=='object')return;if(typeof value.file==='string'&&typeof value.sha256==='string'){
 const resolved=[path.resolve(value.file),path.join(engine,value.file),path.join(root,'tests/native-generated-source-accessors',value.file)].find(file=>fs.existsSync(file)&&hash(fs.readFileSync(file))===value.sha256);assert.ok(resolved,value.file);references[name+'|'+value.file]=save(resolved,value.sha256);
}for(const item of Object.values(value))inspect(item);}
for(const [i,key]of names.entries()){name=key;const file=path.resolve(process.argv[i+2]);reports[name]=JSON.parse(fs.readFileSync(file));inspect(reports[name]);tree(path.dirname(file));}
for(const directory of ['src','utils','lib'])tree(path.join(root,directory));
const oracle=path.join(engine,'tests/nativeFlashOracle/public-function-storage');tree(oracle);
const receipt=JSON.parse(fs.readFileSync(path.join(oracle,'evidence/receipt.json'))),oracleInputs=[];for(const [file,sha256]of Object.entries(receipt.inputs))if(file.includes('GITHUB REPO'))oracleInputs.push({file:save(file,sha256),sha256});
const runnerInputs=[];for(const fixture of ['public-function-storage','source-accessors','object-field-calls','lexical-functions'])for(const filename of fs.readdirSync(path.join(root,'tests/native-generated-'+fixture)).filter(n=>/\.(cjs|ts)$/.test(n))){const file=save(path.join(root,'tests/native-generated-'+fixture,filename));runnerInputs.push({file,sha256:files.get(file).sha256});}
const bytes=zlib.gzipSync(JSON.stringify({reports,references,oracle,oracleInputs,runnerInputs,files:[...files.values()]}),{level:9});fs.writeFileSync(path.join(__dirname,'runtime.json.gz'),bytes);fs.writeFileSync(path.join(__dirname,'runtime-pin.json'),JSON.stringify({sha256:hash(bytes),bytes:bytes.length,files:files.size,AIRRows:17,adjacentRows:64,engine:'8ae9f5b793d1c56a00a45daf527c68c2f4b70d3f',compilerBase:'5d5a67d5aecc6c5aa39481a3214afa3c268fb6bf',wholeClientQualified:false},null,2)+'\n');console.log(JSON.stringify({bytes:bytes.length,files:files.size}));
