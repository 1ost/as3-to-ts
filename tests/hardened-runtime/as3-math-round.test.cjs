'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),ts=require(path.join(root,'node_modules/typescript-4-9'));
// In-memory CommonJS loader: cache partial exports before loading cyclic runtime imports.
const cache=new Map();
function load(file){
 file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;
 const mod={exports:{}};cache.set(file,mod);
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 Function('require','module','exports',js)(id=>id.startsWith('.')?load(path.resolve(path.dirname(file),id+'.ts')):require(id),mod,mod.exports);
 return mod.exports;
}

const {as3MathRound:round}=load(path.join(root,'src/hardened-runtime/AS3Coerce.ts'));
const fixtureRoot=path.join(process.env.HARDENED_FIXTURE_LAYA||path.resolve(root,'../LayaAir'),'tests/nativeFlashOracle');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function evidence(folder,name){const p=path.join(fixtureRoot,folder),retained=JSON.parse(fs.readFileSync(path.join(p,'native-air.json')));assert.equal(hash(fs.readFileSync(path.join(p,name+'.as'))),retained.sourceFiles[name+'.as']);assert.equal(hash(fs.readFileSync(path.join(p,'scenario.json'))),retained.scenarioSha256);return {rows:retained.capture.state.observations,scenario:JSON.parse(fs.readFileSync(path.join(p,'scenario.json')))};}
const words=value=>{const b=Buffer.alloc(8);b.writeDoubleBE(value);return [b.readUInt32BE(0),b.readUInt32BE(4)];};
const number=pair=>{const b=Buffer.alloc(8);b.writeUInt32BE(pair[0]);b.writeUInt32BE(pair[1],4);return b.readDoubleBE();};
const encode=value=>Number.isNaN(value)?['NaN']:value===Infinity?['Infinity']:value===-Infinity?['-Infinity']:value===0?['zero',1/value<0?'negative':'positive']:['finite',value];
test('all32 exact native input patterns preserve rounded and reciprocal bitwords',()=>{
 const {rows}=evidence('math-round-bits','MathRoundBitsProbe');assert.equal(rows.length,32);
 for(const row of rows){const input=number(row.result[0]),rounded=round(input);assert.deepEqual([words(input),words(rounded),words(1/rounded)],row.result,row.id);}
});
test('original GIF quantization and frame sequences match native with state retained',()=>{
 const {rows,scenario}=evidence('math-round','MathRoundProbe');assert.equal(rows.length,47);const native=new Map(rows.map(row=>[row.id,row.result]));let error=0;
 for(const step of scenario.steps){const call=step.calls[0];if(!['frame','quantize'].includes(call.method))continue;
  const [delay,tick,reset]=call.args;if(reset)error=0;
  const input=(call.method==='frame'&&delay<20?100:delay)+error;
  const quantized=round(input/tick)*tick;error=input-quantized;
  const output=call.method==='frame'?Math.max(round(quantized)-tick/2,0):quantized;
  assert.deepEqual([encode(output),encode(error),encode(1/output)],native.get(step.id),step.id);
 }
 for(const row of rows.slice(0,31)){const tagged=row.result[0],input=tagged[0]==='finite'?tagged[1]:tagged[0]==='zero'?(tagged[1]==='negative'?-0:0):Number(tagged[0]);const rounded=round(input);assert.deepEqual([encode(input),encode(rounded),encode(1/rounded)],row.result,row.id);}
});
test('native input-origin gaps remain visible and are not relabeled as rounding parity',()=>{
 const {rows,scenario}=evidence('math-round-bits','MathRoundBitsProbe');const native=new Map(rows.map(row=>[row.id,row.result]));
 const values=[4503599627370495.5,-4503599627370495.5,4503599627370497,-4503599627370497,9007199254740991,-9007199254740991,.49999999999999994,-.5,-0,0/0,Infinity,-Infinity];const gaps=[];
 for(const step of scenario.steps){const call=step.calls[0],input=call.method==='sourceValue'?values[call.args[0]]:call.method==='fromWords'?number(call.args):call.args[0];if(JSON.stringify(words(input))!==JSON.stringify(native.get(step.id)[0]))gaps.push(step.id);}
 assert.deepEqual(gaps,['json-0','json-1','source-9']);
 assert.equal(round(-0.25),0);assert.equal(1/round(-0.25),Infinity);assert.equal(round(.49999999999999994),1);assert.equal(round(4503599627370497),4503599627370498);
 assert.throws(()=>round('1'),/numeric input/);
});
