const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2-internal-values-review');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),fileHash=f=>sha(fs.readFileSync(f));
assert.equal(process.argv.length,4,'Pass combined and ordinary report files');
const reports=process.argv.slice(2).map(f=>JSON.parse(fs.readFileSync(path.resolve(f))));
const pin={engineCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim(),baselineCompilerCommit:'40065ffcaac7ad55176c2a7712c4d6eaa2dc7472',reports:[]};
reports.forEach((report,i)=>{
 assert.equal(report.combined,i===0);assert.equal(report.runnerSha256,fileHash(path.join(__dirname,'run.cjs')));
 for(const item of report.compilerInputs)assert.equal(sha(fs.readFileSync(path.join(root,item.file),'utf8').replace(/\r\n/g,'\n')),item.sha256,item.file);
 for(const item of report.typecheck.inputs)assert.equal(fileHash(item.file),item.sha256,item.file);
 for(const item of report.providerGraph)assert.equal(fileHash(path.resolve(engine,item.file)),item.sha256,item.file);
 const bytes=zlib.gzipSync(Buffer.from(JSON.stringify(report)),{level:9}),file=i===0?'combined.json.gz':'ordinary.json.gz';
 fs.writeFileSync(path.join(__dirname,file),bytes);pin.reports.push({file,sha256:sha(bytes)});
});
fs.writeFileSync(path.join(__dirname,'native-pin.json'),JSON.stringify(pin,null,2)+'\n');
console.log('Retained both native internal value signature comparisons');
