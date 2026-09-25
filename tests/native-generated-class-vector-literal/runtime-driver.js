// Observer only: all three subjects are complete emitted AS3 classes.
const cls=name=>load('nativeClass').readNativeClass(load(name)[name]);
const A=cls('A'),B=cls('B'),ClassValues=cls('ClassValues');
const rows=[],row=(id,value)=>rows.push({id,value});
const v=ClassValues.make(A,null,B);
row('values',[v.length,v.fixed,v[0]===A,v[1]===null,v[2]===B,ClassValues.history()]);
v.push(A);row('growth',[v.length,v[3]===A]);
const empty=ClassValues.empty();row('empty',[empty.length,empty.fixed]);
const again=ClassValues.make(A,undefined,B);row('undefined',[again[1]===null,again!==v,ClassValues.history()]);
try{ClassValues.make(A,{},B);row('invalid-middle','accepted');}catch(e){row('invalid-middle',[api.as3GetProperty(e,'errorID'),ClassValues.history()]);}
try{ClassValues.make({},A,B);row('invalid-first','accepted');}catch(e){row('invalid-first',[api.as3GetProperty(e,'errorID'),ClassValues.history()]);}
globalThis.result=rows;
