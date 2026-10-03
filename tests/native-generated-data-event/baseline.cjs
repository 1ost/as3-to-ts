const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict');
const compiler=path.resolve(__dirname,'../../../as3-to-ts-op2-ancestor-static-review');
const commit=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:compiler,encoding:'utf8'}).trim();assert.equal(commit,'d0a6f010b26acdf5fc9a7567a49df5a1f424eb4a');
const results=[];for(const target of ['ES5','ES2015']){
 const script="const {compile,root}=require('./compile.cjs');try{compile(require('path').join(root,'.cache/data-event-baseline',process.argv[1]),process.argv[1]);process.exit(2);}catch(e){console.log(JSON.stringify({target:process.argv[1],message:e.message}));}";
 const r=cp.spawnSync(process.execPath,['-e',script,target],{cwd:__dirname,encoding:'utf8',env:{...process.env,LAYA_ENGINE_REPOSITORY:path.resolve(__dirname,'../../../LayaAir-op2-data-event-compiler-review'),AS3_TEST_COMPILER_API:path.join(compiler,'lib')}});
 assert.equal(r.status,0,r.stderr);const row=JSON.parse(r.stdout);assert.match(row.message,/AS3_REFERENCE_COERCION_UNSUPPORTED: reference type operation requires class-evaluation authority: flash.events.DataEvent/);results.push(row);
}
fs.writeFileSync(path.join(__dirname,'baseline.json'),JSON.stringify({compiler,commit,results},null,2)+'\n');console.log(JSON.stringify({status:'baseline-rejected',targets:2}));
