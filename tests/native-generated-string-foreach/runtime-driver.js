// Observer only. Enumeration is the complete unchanged captured source.
const Enumeration=load('nativeClass').readNativeClass(load('Enumeration').Enumeration);
const rows=[],row=(id,value)=>rows.push({id,value}),e=new Enumeration();
const obj=entries=>{const value=api.as3CreateDynamicObject();for(const [key,item] of entries||[])api.as3SetProperty(value,key,item);return value;};
row('empty',[e.values(null),e.values(undefined),e.values([]),e.values(obj())]);
row('scalars',[e.values(17),e.values(true),e.values('abc')]);
row('array',e.values([17,true,false,null,undefined,'x',NaN,Infinity,-0]));
const sparse=[];sparse[2]='only';row('sparse',e.values(sparse));
row('object',e.values(obj([['one',42]])));
const d=new api.Dictionary();api.as3SetProperty(d,obj(),23);row('dictionary',e.values(d));
row('flow',e.flow(['skip',1,'stop',2]));row('flow-last-skip',e.flow([1,'skip']));
row('stable',e.stable([1,2,3],[99]));
const events=[];
const convert=obj([['toString',()=>{events.push('toString');return 'converted';}],['valueOf',()=>{events.push('valueOf');return 3;}]]);
row('conversion',e.values([convert]));row('conversion-events',events);
const bad=obj([['toString',()=>{throw new api.Error('fail',321);}]]);
row('failed-conversion',e.failure(['before',bad,'after']));row('failed-first',e.failure([bad]));row('null-retained',e.failure([null,bad]));
globalThis.result=rows;
