const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),z=require('node:zlib'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const git=(cwd,...args)=>cp.execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
const dirs=process.argv.slice(2).map(d=>path.resolve(d));assert.equal(dirs.length,5);
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY),baseline=path.resolve(process.env.CAST_BASELINE_COMPILER);
assert.equal(git(engine,'status','--porcelain'),'');assert.equal(git(baseline,'status','--porcelain'),'');
assert.equal(git(baseline,'rev-parse','HEAD'),'8f2c555c17c93a87e6fd41ea59d7aaa70ad539c8');
const stdout=cp.execFileSync(process.execPath,[path.join(__dirname,'run.cjs'),'--baseline'],{cwd:root,encoding:'utf8',env:process.env});
const baselineResults=stdout.trim().split(/\r?\n/).map(line=>JSON.parse(line));assert.equal(baselineResults.length,2);
const records=dirs.map(dir=>({dir,report:JSON.parse(fs.readFileSync(path.join(dir,'report.json'))),files:fs.readdirSync(dir,{recursive:true}).filter(f=>fs.statSync(path.join(dir,f)).isFile()&&f!=='report.json').map(file=>{const bytes=fs.readFileSync(path.join(dir,file));return {file:path.join(dir,file),sha256:hash(bytes),base64:bytes.toString('base64')};})}));
const archive=new Map(records.flatMap(r=>r.files.map(f=>[f.file,f]))),inputs=new Map();
function collect(value){if(!value||typeof value!=='object')return;
 if(typeof value.file==='string'&&typeof value.sha256==='string'&&path.isAbsolute(value.file)){
  const sha=hash(archive.has(value.file)?Buffer.from(archive.get(value.file).base64,'base64'):fs.readFileSync(value.file));
  assert.equal(sha,value.sha256,value.file);inputs.set(value.file,value.sha256);
 }
 for(const child of Object.values(value))if(typeof child==='object')collect(child);
}
records.forEach(r=>collect(r.report));
const inventory=repo=>['src','lib'].flatMap(folder=>fs.readdirSync(path.join(repo,folder),{recursive:true}).filter(f=>/\.(ts|js)$/.test(f)).map(f=>{const file=path.join(repo,folder,f);return {file,sha256:hash(fs.readFileSync(file))};}));
const packet={engine:{root:engine,commit:git(engine,'rev-parse','HEAD')},compiler:{root,baseCommit:git(root,'rev-parse','HEAD'),inputs:inventory(root)},baseline:{root:baseline,commit:git(baseline,'rev-parse','HEAD'),results:baselineResults,inputs:inventory(baseline)},records,inputs:[...inputs].map(([file,sha256])=>({file,sha256})),wholeClientQualified:false};
const bytes=z.gzipSync(Buffer.from(JSON.stringify(packet)),{level:9});fs.writeFileSync(path.join(__dirname,'runtime.json.gz'),bytes);
fs.writeFileSync(path.join(__dirname,'runtime-pin.json'),JSON.stringify({sha256:hash(bytes),engine:packet.engine.commit,compilerBase:packet.compiler.baseCommit,rows:[14,11,11,9,14]},null,2)+'\n');
console.log(JSON.stringify({bytes:bytes.length,records:records.length,inputs:inputs.size}));
