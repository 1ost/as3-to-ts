const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{gzipSync}=require('node:zlib'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),hash=v=>createHash('sha256').update(v).digest('hex'),file=path.resolve(process.argv[2]),bytes=fs.readFileSync(file),report=JSON.parse(bytes);
assert.equal(hash(fs.readFileSync(path.join(__dirname,'run.cjs'))),report.runnerSha256);
for(const item of [...report.compilerInputs,...report.typechecks.flatMap(t=>t.inputs),...report.results.flatMap(r=>r.inputs)])assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
const artifact=gzipSync(bytes,{level:9});fs.writeFileSync(path.join(__dirname,'report.json.gz'),artifact);
const compilerInputs=report.compilerInputs.map(item=>({file:path.relative(root,item.file).replaceAll('\\','/'),sha256:hash(fs.readFileSync(item.file,'utf8').replace(/\r\n/g,'\n'))}));
fs.writeFileSync(path.join(__dirname,'pin.json'),JSON.stringify({sha256:hash(artifact),compilerInputs,baselineCommit:'161810596b2c9578644ae70225f05a29f31792c5',engineCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2-source-namespace-review'),encoding:'utf8'}).trim()},null,2)+'\n');
console.log('Retained large-cohort type and runtime comparison');
