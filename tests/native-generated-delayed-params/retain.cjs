const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{gzipSync}=require('node:zlib'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),hash=v=>createHash('sha256').update(v).digest('hex'),bytes=fs.readFileSync(path.resolve(process.argv[2])),report=JSON.parse(bytes);
assert.equal(report.runnerSha256,hash(fs.readFileSync(path.join(__dirname,'run.cjs'))));
for(const item of report.compilerInputs)assert.equal(hash(fs.readFileSync(path.join(root,item.file),'utf8').replace(/\r\n/g,'\n')),item.sha256,item.file);
for(const item of [...report.dependencyPins,...report.results.flatMap(r=>[...r.bundleInputs,...r.typechecks.flatMap(c=>c.inputs)])])assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
const compressed=gzipSync(bytes,{level:9});fs.writeFileSync(path.join(__dirname,'runtime.json.gz'),compressed);
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2-delayed-params-review');
fs.writeFileSync(path.join(__dirname,'runtime-pin.json'),JSON.stringify({sha256:hash(compressed),engineCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim(),baselineCompilerCommit:'6bcb396b4b0175ed0bd201a1e9c5541bb588ddaa'},null,2)+'\n');
