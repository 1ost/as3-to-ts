// Observer only; the complete source Enumeration is emitted unchanged.
const Enumeration=load('nativeClass').readNativeClass(load('Enumeration').Enumeration);
const rows=[],row=(id,value)=>rows.push({id,value}),e=new Enumeration();
const obj=entries=>{const value=api.as3CreateDynamicObject();for(const [key,item] of entries||[])api.as3SetProperty(value,key,item);return value;};
const ordered=value=>value.sort((a,b)=>String(a[1])<String(b[1])?-1:String(a[1])>String(b[1])?1:0);
row('empty',[e.keys(null),e.keys(undefined),e.keys(obj())]);
row('scalars',[e.keys(17),e.keys('abc'),e.keys(true)]);
row('array',e.keys([10,20,30]));
const sparse=[];sparse[2]=1;sparse.extra=2;row('sparse',ordered(e.keys(sparse)));
row('object',ordered(e.keys(obj([['0',1],['01',2],['268435455',3],['268435456',4],['name',5]]))));
row('empty-last',[e.last(null),e.last(obj())]);row('last',e.last([10]));
row('parameter-empty',e.parameter(null,'initial'));row('parameter-array',e.parameter([10],'initial'));
row('flow',e.flow([10,20,30,40]));row('stable',e.stable([10,20,30],obj([['changed',1]])));
[17,true,null,undefined,obj()].forEach((key,i)=>{const d=new api.Dictionary();api.as3SetProperty(d,key,1);row('dictionary-'+i,e.keys(d));});
globalThis.result=rows;
