const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict');
const compiler=path.resolve(__dirname,'../../../as3-to-ts-op2-display-accessor-review');
const commit=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:compiler,encoding:'utf8'}).trim();
assert.equal(commit,'3e14ebd829dbf0e8b2d86a327ebd2a6a22a0e75d');
const result=cp.spawnSync(process.execPath,[path.join(__dirname,'run.cjs'),'--baseline'],{
 cwd:path.resolve(__dirname,'../..'),encoding:'utf8',env:{...process.env,
 LAYA_ENGINE_REPOSITORY:path.resolve(__dirname,'../../../LayaAir-op2-display-accessor-review'),
 AS3_TEST_COMPILER_API:path.join(compiler,'lib')}});
assert.equal(result.status,0,result.stderr);
const data=JSON.parse(result.stdout);assert.equal(data.status,'baseline-rejected');
fs.writeFileSync(path.join(__dirname,'baseline.json'),JSON.stringify({compiler,commit,...data},null,2)+'\n');
console.log(JSON.stringify({status:data.status,commit}));
