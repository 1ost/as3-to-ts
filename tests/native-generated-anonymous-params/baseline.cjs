const Module=require('node:module'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const old=path.resolve(process.env.AS3_BASELINE_REPOSITORY||'../as3-to-ts-op2-static-instance-review');
assert.equal(cp.execFileSync('git',['rev-parse','HEAD'],{cwd:old,encoding:'utf8'}).trim(),'f8c121a4a32adc0edc81ee4aefcd096c0e25e44b');
const load=Module._load,selected=path.resolve(__dirname,'../../lib');Module._load=function(name,parent,isMain){return load.call(this,name===selected?path.join(old,'lib'):name,parent,isMain);};
process.argv.push('--baseline');require('./run.cjs');
