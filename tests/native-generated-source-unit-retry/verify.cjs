const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib'),cp=require('node:child_process');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),pin=require('./runtime-pin.json'),bytes=fs.readFileSync(path.join(__dirname,'runtime.json.gz'));
assert.equal(hash(bytes),pin.sha256);const packet=JSON.parse(z.gunzipSync(bytes));
assert.equal(packet.engineCommit,pin.engine);assert.equal(packet.compilerBase,pin.compilerBase);assert.equal(packet.wholeClientQualified,false);
const oracle=name=>require(path.join(packet.engineRoot,'tests/nativeFlashOracle',name,'verify.cjs'));
const expected=[oracle('source-unit-initializer-retry'),oracle('script-global-initializer-retry'),require(path.join(packet.compilerRoot,'../op2-html5/game-client-laya/tests/derived-script-retry/verify.cjs')),oracle('local-function-intrinsics'),oracle('file-local-classes').concat(oracle('file-local-lifetime'))];
const archived=new Map();assert.equal(packet.records.length,5);
for(const [index,record]of packet.records.entries()){
 for(const file of record.files){const b=Buffer.from(file.base64,'base64');assert.equal(hash(b),file.sha256,file.file);archived.set(file.file,b);}
 assert.equal(record.report.results.length,2);
 for(const [i,result]of record.report.results.entries()){
  assert.equal(result.target,['ES5','ES2015'][i]);assert.deepEqual(result.node,result.web);
  const rows=result.node.rows.concat(result.node.lifetimeRows||[]);assert.equal(rows.length,pin.rows[index]);assert.deepEqual(rows,expected[index]);
  for(const check of result.typechecks)assert.deepEqual(check.diagnostics,[]);
  if(index===0){
   assert.equal(result.rejectionGuards,6);assert.equal(result.node.domainChecks.length,7);assert.ok(result.node.domainChecks.every(Boolean));assert.equal(result.mutations.length,3);
   for(const mutation of result.mutations){assert.deepEqual(mutation.node,mutation.web);assert.ok(record.files.some(file=>file.sha256===mutation.bundleSha256));
    if(mutation.name==='discard-failed-source-global')assert.match(mutation.node.error,/failed source function creation context/);
    else{assert.equal(mutation.node.error,undefined);assert.notDeepEqual(mutation.node.value.rows,expected[0]);}
   }
  }
 }
}
const runners=['native-generated-source-unit-retry','native-generated-class-script-retry','native-generated-derived-script-retry','native-generated-local-function-intrinsics','native-generated-private-modules'];
for(const [i,runner]of runners.entries())for(const [file,key]of [['run.cjs','runnerSha256'],['observer.ts','observerSha256']])assert.equal(hash(fs.readFileSync(path.join(packet.compilerRoot,'tests',runner,file))),packet.records[i].report[key]);
if(process.argv.includes('--check-current')){
 assert.equal(cp.execFileSync('git',['rev-parse','HEAD'],{cwd:packet.engineRoot,encoding:'utf8'}).trim(),packet.engineCommit);
 for(const input of [...packet.compilerInputs,...packet.inputs])assert.equal(hash(archived.get(input.file)||fs.readFileSync(input.file)),input.sha256,input.file);
 const inventory=['src','lib'].flatMap(folder=>fs.readdirSync(path.join(packet.compilerRoot,folder),{recursive:true}).filter(f=>/\.(ts|js)$/.test(f)).map(f=>path.join(packet.compilerRoot,folder,f))).sort();
 assert.deepEqual(inventory,packet.compilerInputs.map(i=>i.file).sort());
}
console.log(JSON.stringify({status:'passed',AIRRows:58,adjacentRows:71,targets:2,mainRuntimes:['Node','strict-CSP Chromium'],guardsPerTarget:6,mutationsPerTarget:3,domainChecksPerTarget:7,typeErrors:0,wholeClientQualified:false}));
