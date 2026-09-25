"use strict";
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'as3-invocation-'));
fs.writeFileSync(path.join(out,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'CommonJS',strict:true,skipLibCheck:true,rootDir:path.join(root,'src'),outDir:out},files:[path.join(root,'src/hardened-runtime/AS3Function.ts'),path.join(root,'src/hardened-runtime/AS3ObjectDispatch.ts'),path.join(root,'src/hardened-runtime/AS3Array.ts')]}));
cp.execFileSync(process.execPath,[path.join(root,'node_modules/typescript-4-9/bin/tsc'),'-p',path.join(out,'tsconfig.json')]);
const fn=require(path.join(out,'hardened-runtime/AS3Function.js')),r=require(path.join(out,'hardened-runtime/AS3ObjectDispatch.js'));
const registry=require(path.join(out,'hardened-runtime/internal/AS3TypeRegistry.js'));
const metadata={schema:'as3-runtime-type-authority@1',qnames:[],entries:[]};
registry.installAS3TypeAuthority({schema:metadata.schema,sha256:require('node:crypto').createHash('sha256').update(JSON.stringify(metadata)).digest('hex'),qnames:metadata.qnames,entries:metadata.entries});
test.after(()=>fs.rmSync(out,{recursive:true,force:true}));
test('Object updates retain receiver and key, with separate native read/store conversions',()=>{
 const events=[],target={first:{valueOf(){events.push('value');return 9;}},second:50};let count=0;
 const key={toString(){events.push('key');return ++count===1?'first':'second';}};
 assert.equal(r.as3ObjectUpdate(target,key,1,false),9);
 assert.equal(target.second,10);assert.equal(typeof target.first,'object');
 assert.deepEqual(events,['key','value','key']);
});
test('Object update coercions, missing values and failure order match native semantics',()=>{
 for(const [value,expected] of [['4',5],[null,1],[true,2],[false,1],[undefined,NaN]]) {
  const target={count:value};const result=r.as3ObjectUpdate(target,'count',1,true);
  assert.equal(result,expected);assert.equal(target.count,expected);
 }
 let keys=0;const key={toString(){keys++;return 'count';}};
 assert.throws(()=>r.as3ObjectUpdate(null,key,1,true),{name:'TypeError',errorID:1009});assert.equal(keys,0);
 const failing={valueOf(){throw new Error('no conversion');}},target={count:failing};
 assert.throws(()=>r.as3ObjectUpdate(target,key,1,true),/no conversion/);assert.equal(target.count,failing);assert.equal(keys,1);
 assert.equal(r.as3ObjectUpdate({count:4},'count',0,false),4);
});
test('direct Function invocation preserves argument evaluation and bound receivers',()=>{
 const owner={value:10};function add(n){this.value+=n;return this.value;}const callback=add.bind(owner);
 assert.equal(fn.as3FunctionInvoke(callback,[8]),18);assert.equal(owner.value,18);
 const events=[];assert.throws(()=>fn.as3FunctionInvoke(null,[events.push('argument')]),{name:'TypeError',errorID:1006,message:'Error #1006: value is not a function.'});assert.deepEqual(events,['argument']);
 const failing=()=>{throw new Error('callback failed');};assert.throws(()=>fn.as3FunctionInvoke(failing,[]),/callback failed/);
});
test('explicit Function fields retain the native receiver and late field read',()=>{
 const owner={callback:function(){return this===owner;}};
 assert.equal(fn.as3FunctionFieldInvoke(owner,'callback',[]),true);
 assert.equal(fn.as3FunctionInvoke(owner.callback,[]),false);
 const events=[];owner.callback=()=>events.push('old');
 function replace(){events.push('argument');owner.callback=()=>events.push('new');return 0;}
 fn.as3FunctionFieldInvoke(owner,'callback',[replace()]);assert.deepEqual(events,['argument','new']);
 owner.callback=null;
 assert.throws(()=>fn.as3FunctionFieldInvoke(owner,'callback',[]),{name:'TypeError',errorID:1006});
 assert.throws(()=>fn.as3FunctionFieldInvoke({},'missing',[]),fn.AS3FunctionOperationUnavailable);
 let read=false;assert.throws(()=>fn.as3FunctionFieldInvoke({get callback(){read=true;return ()=>0;}},'callback',[]),fn.AS3FunctionOperationUnavailable);assert.equal(read,false);
});
test('Function field receiver dispatch matches the retained native-only dynamic-this probe',{skip:!process.env.HARDENED_FIXTURE_LAYA},()=>{
 const p=path.join(process.env.HARDENED_FIXTURE_LAYA,'tests/nativeFlashOracle/function-field-receiver');
 const golden=JSON.parse(fs.readFileSync(path.join(p,'native-air.json'),'utf8')),crypto=require('node:crypto');
 for(const row of golden.sourceFiles)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(p,row.path))).digest('hex'),row.sha256);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(p,'scenario.json'))).digest('hex'),golden.scenarioSha256);
 const owner={callback:function(){return this===owner;}},local=owner.callback;
 const result=[fn.as3FunctionFieldInvoke(owner,'callback',[]),fn.as3FunctionInvoke(owner.callback,[]),fn.as3FunctionInvoke(local,[]),fn.as3FunctionCall(owner.callback,null,[]),fn.as3FunctionCall(owner.callback,owner,[])];
 assert.deepEqual(result,golden.capture.state.observations[0].result);
});
test('Function.apply dynamically checks its argument list with AIR error 1116',{skip:!process.env.HARDENED_FIXTURE_LAYA},()=>{
 const p=path.join(process.env.HARDENED_FIXTURE_LAYA,'tests/nativeFlashOracle/dynamic-function-apply-arguments');
 const golden=JSON.parse(fs.readFileSync(path.join(p,'native-air.json'),'utf8')).capture.state.observations;
 const target=(...values)=>values.length+':'+values.map(value=>value===undefined?'undefined':String(value)).join('|');
 const capture=value=>{try{return fn.as3FunctionApply(target,null,value);}catch(error){return error.name+'|'+error.errorID+'|'+error.message;}};
 const sparse=[];sparse.length=3;sparse[1]='m';
 const values={array:[3,'x'],null:null,undefined:undefined,sparse,object:{},string:'xy','array-like':{0:'a',1:'b',length:2}};
 assert.deepEqual(Object.entries(values).map(([id,value])=>({result:capture(value),id})),golden);
});
test('instance method arity rejects excess arguments and permits rest slots',()=>{
 fn.as3CheckMethodArity('Probe','rest',5,0,null);fn.as3CheckMethodArity('Probe','optional',1,0,1);
 assert.throws(()=>fn.as3CheckMethodArity('Probe','optional',2,0,1),{name:'ArgumentError',errorID:1063,message:'Error #1063: Argument count mismatch on Probe/optional(). Expected 0, got 2.'});
 assert.throws(()=>fn.as3CheckMethodArity('Probe','required',0,1,1),{name:'ArgumentError',errorID:1063});
});
test('unqualified anonymous Function arity fails before parameter/body effects',()=>{
 fn.as3CheckLambdaArity(1,1,2);fn.as3CheckLambdaArity(2,1,2);fn.as3CheckLambdaArity(100,1,null);
 assert.throws(()=>fn.as3CheckLambdaArity(0,1,2),fn.AS3FunctionOperationUnavailable);
 assert.throws(()=>fn.as3CheckLambdaArity(3,1,2),fn.AS3FunctionOperationUnavailable);
});

test('Array length stores uint after the receiver check and returns the original input',()=>{
 const {as3ArrayLengthWrite}=require(path.join(out,'hardened-runtime/AS3Array.js'));
 const events=[],input={valueOf(){events.push('convert');return 2;}},values=[1,2,3];
 assert.equal(as3ArrayLengthWrite(values,input),input);assert.deepEqual(values,[1,2]);assert.deepEqual(events,['convert']);
 events.length=0;assert.throws(()=>as3ArrayLengthWrite(null,input),{name:'TypeError',errorID:1009});assert.deepEqual(events,[]);
 for(const [input,length] of [[-1,4294967295],[1.9,1],[NaN,0],[Infinity,0],[null,0],[undefined,0],[4294967298,2],['0x2',2]]) {
  const values=[1,2,3];assert.equal(as3ArrayLengthWrite(values,input),input);assert.equal(values.length,length);
 }
});

test('sortOn retains native tied-priority identity order beyond the small partitions',()=>{
 const {as3ArrayCall}=require(path.join(out,'hardened-runtime/AS3Array.js'));
 const rows=Array.from({length:12},(_,id)=>({id,priority:(id*7)%5-2}));
 const original=rows.slice();assert.equal(as3ArrayCall(rows,'sortOn',['priority',18]),rows);
 assert.deepEqual(rows.map(row=>row.id),[2,7,9,4,1,6,11,3,8,0,10,5]);
 rows.forEach(row=>assert.equal(row,original[row.id]));
 const forty=Array.from({length:40},(_,id)=>({id,priority:(id*7)%5-2}));
 as3ArrayCall(forty,'sortOn',['priority',18]);
 assert.deepEqual(forty.map(row=>row.id),[27,37,2,32,7,12,22,17,4,9,19,24,14,34,39,29,16,11,6,31,1,21,26,36,8,38,23,28,18,33,13,3,30,15,5,35,10,0,25,20]);
});
test('sortOn snapshots fields backwards and delays all writes until getters succeed',()=>{
 const {as3ArrayCall}=require(path.join(out,'hardened-runtime/AS3Array.js'));const events=[];
 let fail=false;const rows=Array.from({length:5},(_,id)=>({id,get priority(){events.push(id);if(fail&&id===2)throw new Error('priority failed');return id%2;}}));
 as3ArrayCall(rows,'sortOn',['priority',18]);assert.deepEqual(events,[4,3,2,1,0]);assert.deepEqual(rows.map(row=>row.id),[3,1,0,2,4]);
 rows.sort((a,b)=>a.id-b.id);events.length=0;fail=true;
 assert.throws(()=>as3ArrayCall(rows,'sortOn',['priority',18]),/priority failed/);
 assert.deepEqual(events,[4,3,2]);assert.deepEqual(rows.map(row=>row.id),[0,1,2,3,4]);
});
test('sortOn descending exchanges numeric conversion operands before comparing',()=>{
 const {as3ArrayCall}=require(path.join(out,'hardened-runtime/AS3Array.js'));const events=[];
 const rows=[{id:'a',priority:{valueOf(){events.push('a');return 3;}}},{id:'b',priority:{valueOf(){events.push('b');return 7;}}},{id:'c',priority:5}];
 as3ArrayCall(rows,'sortOn',['priority',18]);assert.deepEqual(rows.map(row=>row.id),['b','c','a']);assert.deepEqual(events,['b','a','a','b']);
});
test('sortOn partitions absent slots and primitive rows without boxing their fields',()=>{
 const {as3ArrayCall}=require(path.join(out,'hardened-runtime/AS3Array.js'));
 const rows=[{id:'a',priority:1},null,undefined,7,{id:'b',priority:3},'x'];
 as3ArrayCall(rows,'sortOn',['priority',18]);assert.deepEqual(rows.map(row=>row&&row.id||row),['b','a',null,undefined,7,'x']);
 const sparse=[{id:0,priority:0},,{id:2,priority:2}];sparse.length=6;
 as3ArrayCall(sparse,'sortOn',['priority',18]);assert.equal(sparse.length,6);assert.deepEqual(Object.keys(sparse),['0','1']);assert.deepEqual(sparse.slice(0,2).map(row=>row.id),[2,0]);
});
test('sortOn keeps unqualified modes and host storage explicit',()=>{
 const {as3ArrayCall}=require(path.join(out,'hardened-runtime/AS3Array.js'));
 for(const options of [0,2,4,8,20,24]) assert.throws(()=>as3ArrayCall([],'sortOn',['priority',options]),{name:'AS3ArraySortOperationUnavailable'});
 assert.throws(()=>as3ArrayCall(null,'sortOn',['priority',18]),{errorID:1009});
 assert.throws(()=>as3ArrayCall(undefined,'sortOn',['priority',18]),{errorID:1010});
 const oversized=[];oversized.length=0x10000000;assert.throws(()=>as3ArrayCall(oversized,'sortOn',['priority',18]),{name:'AS3ArraySortOperationUnavailable'});
 const overridden=[];overridden.sortOn=()=>0;assert.throws(()=>as3ArrayCall(overridden,'sortOn',['priority',18]),{name:'AS3ArraySortOperationUnavailable'});
});
