'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {buildSync}=require('esbuild');
test('authenticated intrinsic Date retains zeroarg, numeric epoch and six-component calendar relationships',t=>{
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
	 for(const epoch of [0,-1,1,1234567890123,-1234567890123,.75,-.75])assert.equal(make(epoch).time,new Date(epoch).getTime());
	 for(const epoch of [NaN,Infinity,-Infinity])assert.ok(Number.isNaN(make(epoch).time));
 assert.ok(same(make(2025,12,1,0,0,0),make(2026,0,1,0,0,0)));
 assert.ok(same(make(2024,1,30,0,0,0),make(2024,2,1,0,0,0)));assert.ok(same(make(2023,1,29,0,0,0),make(2023,2,1,0,0,0)));
 const delta=make(2026,0,15,10,20,30);assert.equal(make(2026,0,15,10,20,31).getTime()-delta.getTime(),1000);assert.equal(make(2026,0,15,10,21,30).getTime()-delta.getTime(),60000);
 assert.ok(same(make(0,0,1,0,0,0),make(1900,0,1,0,0,0)));assert.ok(same(make(99,0,1,0,0,0),make(1999,0,1,0,0,0)));
 assert.ok(same(make(2026.9,2.9,3.9,4.9,5.9,6.9),make(2026,2,3,4,5,6)));
 for(const args of [[NaN,0,1,0,0,0],[2026,NaN,1,0,0,0],[2026,0,NaN,0,0,0],[2026,0,1,NaN,0,0],[2026,0,1,0,NaN,0],[2026,0,1,0,0,NaN],
   [Infinity,0,1,0,0,0],[-Infinity,0,1,0,0,0],[2026,Infinity,1,0,0,0],[2026,0,1,0,0,-Infinity]])assert.ok(Number.isNaN(make(...args).getTime()));
 assert.ok(same(make(2026,-1,1,0,0,0),make(2025,11,1,0,0,0)));assert.ok(same(make(2026,0,0,0,0,0),make(2025,11,31,0,0,0)));assert.ok(same(make(2026,0,1,-1,0,0),make(2025,11,31,23,0,0)));
	 for(const args of [[2026,0],[2026,0,1],[2026,0,1,0],[2026,0,1,0,0],[2026,0,1,0,0,0,0]])assert.throws(()=>new AS3Date(...args),TypeError);
	 for(const value of ["0",true,null,undefined,{},new Date(),Symbol("epoch")])assert.throws(()=>new AS3Date(value),TypeError);
 for(const args of [[2026,0,1,0,0,true],[2026,0,1,0,0,null],[2026,0,1,0,0,undefined],[2026,0,1,0,0,{}]])assert.throws(()=>new AS3Date(...args),TypeError);
 for(const args of [["2026",7,"7",10,"20",30],["","","","","",""],["+2026","-1","+1","-1","+0","+0"],["2026.9",2.9,"3.9",4.9,"5.9",6.9]]){
  const actual=make(...args),expected=new Date(...args.map(Number));assert.equal(actual.time,expected.getTime());
 }
});
test('bounded AP Date mutations preserve native normalization, assignment results and receiver guards',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'date-runtime-ap-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const bundle=path.join(dir,'date.cjs');
 buildSync({entryPoints:[path.resolve(__dirname,'../../src/hardened-runtime/AS3Date.ts')],outfile:bundle,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
 const {AS3Date}=require(bundle),make=(...args)=>new AS3Date(...args),same=(left,right)=>left.time===right.getTime();
 let date=make(2026,0,15,10,20,30),expected=new Date(2026,6,15,4,5,6),returned=date.setTime(expected.getTime());
 assert.equal(returned,expected.getTime());assert.equal(date.time,expected.getTime());
 returned=date.setTime(.75);assert.equal(returned,0);assert.equal(date.time,0);returned=date.setTime(NaN);assert.ok(Number.isNaN(returned)&&Number.isNaN(date.time));
 date=make(2026,0,15,10,20,30);returned=date.setHours(-1,61,61);assert.equal(returned,date.time);assert.ok(same(date,new Date(2026,0,15,-1,61,61)));
 date=make(2026,0,15,10,20,30);returned=date.setHours(4.9,5.9,6.9);assert.equal(returned,date.time);assert.ok(same(date,new Date(2026,0,15,4,5,6)));
 for(const values of [[NaN,5,6],[4,NaN,6],[4,5,NaN]]){date=make(2026,0,15,10,20,30);returned=date.setHours(...values);assert.ok(Number.isNaN(returned)&&Number.isNaN(date.time));}
 date=make(2026,0,15,10,20,30);assert.equal(date.minutes,20);let assigned=(date.minutes=61.9);assert.equal(assigned,61.9);assert.equal(date.minutes,1);assert.ok(same(date,new Date(2026,0,15,10,61,30)));
 date=make(2026,0,15,10,20,30);let compound=(date.minutes-=61.9);assert.equal(compound,-41.9);assert.equal(date.minutes,19);assert.ok(same(date,new Date(2026,0,15,10,-41.9,30)));
 date=make(2026,0,15,10,20,30);assigned=(date.time=.75);assert.equal(assigned,.75);assert.equal(date.time,0);assigned=(date.time=NaN);assert.ok(Number.isNaN(assigned)&&Number.isNaN(date.time));
 const winter=make(2026,0,15,12,0,0),summer=make(2026,6,15,12,0,0);assert.equal(winter.timezoneOffset,new Date(2026,0,15,12,0,0).getTimezoneOffset());assert.equal(summer.timezoneOffset,new Date(2026,6,15,12,0,0).getTimezoneOffset());
 date=make(2026,0,15,10,20,30);for(const call of [()=>date.setTime(),()=>date.setTime(0,1),()=>date.setTime("0"),()=>date.setHours(1,2),()=>date.setHours(1,2,3,4),()=>date.setHours(1,"2",3)])assert.throws(call,TypeError);
 const minutes=Object.getOwnPropertyDescriptor(AS3Date.prototype,'minutes'),time=Object.getOwnPropertyDescriptor(AS3Date.prototype,'time'),zone=Object.getOwnPropertyDescriptor(AS3Date.prototype,'timezoneOffset');
 for(const call of [()=>AS3Date.prototype.setTime.call({},0),()=>AS3Date.prototype.setHours.call({},1,2,3),()=>minutes.get.call({}),()=>minutes.set.call({},1),()=>time.get.call({}),()=>time.set.call({},1),()=>zone.get.call({})])assert.throws(call,TypeError);
 const detached=date.setTime;assert.throws(()=>detached(0),TypeError);assert.throws(()=>Reflect.set(date,'minutes','1'),TypeError);assert.throws(()=>Reflect.set(date,'time','1'),TypeError);
});
