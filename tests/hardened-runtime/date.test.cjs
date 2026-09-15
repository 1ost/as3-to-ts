'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {buildSync}=require('esbuild');
test('authenticated intrinsic Date retains zeroarg and six-number calendar relationships',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'date-runtime-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const bundle=path.join(dir,'date.cjs');
 buildSync({entryPoints:[path.resolve(__dirname,'../../src/hardened-runtime/AS3Date.ts')],outfile:bundle,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
 const {AS3Date,isAS3Date,as3DateReceiver}=require(bundle);const before=Date.now(),first=new AS3Date(),second=new AS3Date(),after=Date.now();
 assert.equal(as3DateReceiver(first),first);
 for(const [value,id] of [[null,1009],[undefined,1010]])assert.throws(()=>as3DateReceiver(value),e=>e.name==='TypeError'&&e.errorID===id);
 assert.notEqual(first,second);assert.throws(()=>String(first),TypeError);assert.throws(()=>Number(first),TypeError);assert.ok(isAS3Date(first));assert.equal(typeof first,'object');const value=first.valueOf();assert.ok(Number.isFinite(value)&&Number.isInteger(value));assert.ok(value>=before&&value<=after);assert.equal(first.getTime(),value);assert.equal(first.time,value);assert.equal(first.valueOf(),value);
 for(const fake of [null,{},new Date(),Object.create(AS3Date.prototype),new Proxy(first,{})])assert.equal(isAS3Date(fake),false);
 assert.throws(()=>AS3Date.prototype.getTime.call({}),TypeError);
 const make=(...args)=>new AS3Date(...args),same=(left,right)=>left.getTime()===right.getTime();
 const launch=make(2026,7,7,10,0,0);assert.ok(isAS3Date(launch));assert.equal(launch.getTime(),launch.valueOf());assert.equal(launch.time,launch.getTime());
 assert.ok(same(make(2025,12,1,0,0,0),make(2026,0,1,0,0,0)));
 assert.ok(same(make(2024,1,30,0,0,0),make(2024,2,1,0,0,0)));assert.ok(same(make(2023,1,29,0,0,0),make(2023,2,1,0,0,0)));
 const delta=make(2026,0,15,10,20,30);assert.equal(make(2026,0,15,10,20,31).getTime()-delta.getTime(),1000);assert.equal(make(2026,0,15,10,21,30).getTime()-delta.getTime(),60000);
 assert.ok(same(make(0,0,1,0,0,0),make(1900,0,1,0,0,0)));assert.ok(same(make(99,0,1,0,0,0),make(1999,0,1,0,0,0)));
 assert.ok(same(make(2026.9,2.9,3.9,4.9,5.9,6.9),make(2026,2,3,4,5,6)));
 for(const args of [[NaN,0,1,0,0,0],[2026,NaN,1,0,0,0],[2026,0,NaN,0,0,0],[2026,0,1,NaN,0,0],[2026,0,1,0,NaN,0],[2026,0,1,0,0,NaN],
   [Infinity,0,1,0,0,0],[-Infinity,0,1,0,0,0],[2026,Infinity,1,0,0,0],[2026,0,1,0,0,-Infinity]])assert.ok(Number.isNaN(make(...args).getTime()));
 assert.ok(same(make(2026,-1,1,0,0,0),make(2025,11,1,0,0,0)));assert.ok(same(make(2026,0,0,0,0,0),make(2025,11,31,0,0,0)));assert.ok(same(make(2026,0,1,-1,0,0),make(2025,11,31,23,0,0)));
 for(const args of [[0],[2026,0],[2026,0,1],[2026,0,1,0],[2026,0,1,0,0],[2026,0,1,0,0,0,0],[2026,0,1,0,0,"0"]])assert.throws(()=>new AS3Date(...args),TypeError);
});
