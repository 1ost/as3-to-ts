const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict');
const compiler=path.resolve(__dirname,'../../../as3-to-ts-op2-number-accessor-review');
const commit=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:compiler,encoding:'utf8'}).trim();assert.equal(commit,'6ff44aeb369b8ffc3308c507a28f6b515eb36018');
const results=[];
for(const target of ['ES5','ES2015']){
 const script="const {compile,root}=require('./compile.cjs');try{compile(require('path').join(root,'.cache/display-baseline',process.argv[1]),process.argv[1]);process.exit(2);}catch(e){console.log(JSON.stringify({target:process.argv[1],message:e.message}));}";
 const result=cp.spawnSync(process.execPath,['-e',script,target],{cwd:__dirname,encoding:'utf8',env:{...process.env,LAYA_ENGINE_REPOSITORY:path.resolve(__dirname,'../../../LayaAir-op2-display-accessor-review'),AS3_TEST_COMPILER_API:path.join(compiler,'lib')}});
 assert.equal(result.status,0,result.stderr);const data=JSON.parse(result.stdout);assert.match(data.message,/AS3_GENERATED_TRAITS_UNSUPPORTED: duplicate or incompatible public declaration: cases.Child:container/);results.push(data);
}
fs.writeFileSync(path.join(__dirname,'baseline.json'),JSON.stringify({compiler,commit,results},null,2)+'\n');console.log(JSON.stringify({status:'baseline-rejected',targets:2}));
