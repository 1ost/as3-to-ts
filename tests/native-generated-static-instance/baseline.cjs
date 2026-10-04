// Historical compiler replay of the same source fixture; no files or emitted code patched.
const Module=require('node:module'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const old=path.resolve(process.env.AS3_BASELINE_REPOSITORY||'../as3-to-ts-op2-private-uint-review');
assert.equal(cp.execFileSync('git',['rev-parse','HEAD'],{cwd:old,encoding:'utf8'}).trim(),'34507ab16e5d2ba16d2fe0c038ff1d4e715398bf');
const load=Module._load;Module._load=function(name,parent,isMain){return load.call(this,name==='../../lib'?path.join(old,'lib'):name,parent,isMain);};
require('./run.cjs');
