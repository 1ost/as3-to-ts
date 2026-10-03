const path=require('node:path'),cp=require('node:child_process');
const compiler=path.resolve(__dirname,'../..'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2-color-transform-reference-review');
const result=cp.spawnSync(process.execPath,['tests/nativeColorTransformReference/run.cjs'],{cwd:engine,env:{...process.env,AS3_COMPILER_REPOSITORY:compiler},stdio:'inherit'});
if(result.error)throw result.error;process.exit(result.status??1);
