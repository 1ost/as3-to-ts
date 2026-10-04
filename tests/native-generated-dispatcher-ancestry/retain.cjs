const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),root=path.resolve(__dirname,'../..');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2-dispatcher-ancestry-review');
const specs={primary:['dispatcher-ancestry','dispatcher-retry-ancestry'],ancestry:['retry-ancestry','retry-ancestry'],derived:['derived-script-retry',path.resolve('../op2-html5/game-client-laya/tests/derived-script-retry')],dispatcher:['dispatcher-script-retry','generated-dispatcher-script-retry'],dispatcherInternal:['dispatcher-script-retry','generated-dispatcher-script-retry']};
assert.equal(process.argv.length,7,'Pass primary, source ancestry, derived, direct dispatcher and internal dispatcher report paths');
const files=new Map(),reports={},references={},oracles={};let reportName;
function save(file,digest){file=path.resolve(file);const bytes=fs.readFileSync(file);if(digest)assert.equal(hash(bytes),digest,file);if(!files.has(file))files.set(file,{file,sha256:hash(bytes),base64:bytes.toString('base64')});return file;}
function tree(dir){for(const name of fs.readdirSync(dir,{recursive:true})){const file=path.join(dir,name);if(fs.statSync(file).isFile())save(file);}}
function inspect(value){if(!value||typeof value!=='object')return;if(typeof value.file==='string'&&typeof value.sha256==='string')references[reportName+'|'+value.file]=save(value.file,value.sha256);for(const item of Object.values(value))inspect(item);}
for(const [i,[name,[fixture,oracle]]]of Object.entries(specs).entries()){
 reportName=name;const file=path.resolve(process.argv[i+2]);assert.ok(file.startsWith(path.join(root,'.cache')+path.sep));
 const report=reports[name]=JSON.parse(fs.readFileSync(file));inspect(report);tree(path.dirname(file));
 save(path.join(root,'tests/native-generated-'+fixture,'run.cjs'),report.runnerSha256);save(path.join(root,'tests/native-generated-'+fixture,'observer.ts'),report.observerSha256);
 const oracleDir=path.isAbsolute(oracle)?oracle:path.join(engine,'tests/nativeFlashOracle',oracle);tree(oracleDir);
 const receiptFile=path.join(oracleDir,'evidence/receipt.json'),receipt=JSON.parse(fs.readFileSync(receiptFile));
 const tooling=[];if(name==='primary')for(const [file,digest]of Object.entries(receipt.inputs))if(file.includes('GITHUB REPO'))tooling.push({file:save(file,digest),sha256:digest});
 oracles[name]={directory:oracleDir,receiptFile,tooling,fixture};
}
const bytes=zlib.gzipSync(JSON.stringify({reports,references,oracles,files:[...files.values()]}),{level:9});
fs.writeFileSync(path.join(__dirname,'runtime.json.gz'),bytes);
fs.writeFileSync(path.join(__dirname,'runtime-pin.json'),JSON.stringify({sha256:hash(bytes),bytes:bytes.length,files:files.size,rows:19,adjacentDistinctRows:46,adjacentExecutions:65,compilerBase:'9b13f39d7bb815b33059617f794fed9393c0644c',engineRuntimeBase:'bfa25854370b31fdef23fe6451828c87da157f40',wholeClientQualified:false},null,2)+'\n');
console.log(JSON.stringify({bytes:bytes.length,files:files.size}));
