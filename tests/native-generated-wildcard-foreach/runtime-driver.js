// Observer only; the complete source Enumeration is emitted unchanged.
const Enumeration=load('nativeClass').readNativeClass(load('Enumeration').Enumeration);
const rows=[],row=(id,value)=>rows.push({id,value}),e=new Enumeration();
const obj=entries=>{const value=api.as3CreateDynamicObject();for(const [key,item] of entries||[])api.as3SetProperty(value,key,item);return value;};
row('empty',[e.values(null),e.values(undefined),e.values(obj()),e.values([])]);
row('scalars',[e.values(17),e.values('abc'),e.values(true)]);
row('array',e.values([10,20,30]));row('mixed-values',e.values([null,undefined,false,'x',7]));
row('rest-empty',e.restValues());row('rest-values',e.restValues(10,null,'x',false));
row('parameter',[e.parameter([],'seed'),e.parameter([10,20],'seed')]);
row('late',[e.late([])===undefined,e.late([10,20])]);
row('flow',e.flow([10,20,30,40]));row('stable',e.stable([10,20,30],[40]));
row('branch',[e.branch(false,[10,20]),e.branch(true,[10,20])]);row('nested',e.nested([[10,20],[30]]));
row('mixed-rest',e.mixed(obj([['a',1],['b',2]]),'b','a'));row('mixed-keys',e.mixed(obj([['only',7]])));
row('describe',e.describe(obj([['a',1],['b',2]]),'b','a'));
const d=new api.Dictionary();api.as3SetProperty(d,obj(),'value');row('dictionary',e.values(d));
const sparse=[];sparse[3]='single';row('sparse',e.values(sparse));row('object',e.values(obj([['only','own']])));
globalThis.result=rows;
