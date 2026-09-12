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
