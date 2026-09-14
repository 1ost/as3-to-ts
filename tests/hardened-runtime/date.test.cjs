'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {buildSync}=require('esbuild');
test('zeroarg intrinsic Date retains identity and native epoch millisecond relationships',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'date-runtime-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const bundle=path.join(dir,'date.cjs');
 buildSync({entryPoints:[path.resolve(__dirname,'../../src/hardened-runtime/AS3Date.ts')],outfile:bundle,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
 const {AS3Date,isAS3Date,as3DateReceiver}=require(bundle);const before=Date.now(),first=new AS3Date(),second=new AS3Date(),after=Date.now();
 assert.equal(as3DateReceiver(first),first);
 for(const [value,id] of [[null,1009],[undefined,1010]])assert.throws(()=>as3DateReceiver(value),e=>e.name==='TypeError'&&e.errorID===id);
 assert.notEqual(first,second);assert.throws(()=>String(first),TypeError);assert.throws(()=>Number(first),TypeError);assert.ok(isAS3Date(first));assert.equal(typeof first,'object');const value=first.valueOf();assert.ok(Number.isFinite(value)&&Number.isInteger(value));assert.ok(value>=before&&value<=after);assert.equal(first.getTime(),value);assert.equal(first.time,value);assert.equal(first.valueOf(),value);
 for(const fake of [null,{},new Date(),Object.create(AS3Date.prototype),new Proxy(first,{})])assert.equal(isAS3Date(fake),false);
 assert.throws(()=>AS3Date.prototype.getTime.call({}),TypeError);assert.throws(()=>new AS3Date(0),TypeError);
});
