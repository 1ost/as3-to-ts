const Module=require('node:module'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const old=path.resolve(process.env.AS3_BASELINE_REPOSITORY||'../as3-to-ts-op2-anonymous-params-review');
assert.equal(cp.execFileSync('git',['rev-parse','HEAD'],{cwd:old,encoding:'utf8'}).trim(),'3b77842dd4ec73810667f46cb5bcd6b134b4e9eb');
const load=Module._load,selected=path.resolve(__dirname,'../../lib');Module._load=function(name,parent,isMain){return load.call(this,name===selected?path.join(old,'lib'):name,parent,isMain);};
process.argv.push('--baseline');require('./run.cjs');
