// Replay retained String/rest callback sources against the current qualified engine.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Module=require('node:module');
const file=path.resolve(__dirname,'../native-generated-anonymous-params/run.cjs');
let source=fs.readFileSync(file,'utf8');
for(const [before,after]of [
 ["assert.equal(pins.engine,require('./engine.json').commit);","assert.equal(pins.engine,'f5550daab69a5256093f32ab030e10c858d4cf22');"],
 ["require(require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}))","require(process.env.PLAYWRIGHT_MODULE)"]
]){assert.equal(source.split(before).length,2);source=source.replace(before,after);}
const replay=new Module(file,module);replay.filename=file;replay.paths=Module._nodeModulePaths(path.dirname(file));replay._compile(source,file);
