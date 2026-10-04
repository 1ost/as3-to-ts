const read=load('nativeClass').readNativeClass,Base=read(load('Base').Base),Child=read(load('Child').Child);
const a=new Base(),b=new Base(),c=new Child(),rows=[],strings=v=>v.map(String);
a.reset(1.25,2147483647,4294967295);
rows.push({id:'fraction',value:strings(a.addNumber(2.5))});
rows.push({id:'int-overflow',value:strings(a.addInt(1))});rows.push({id:'uint-overflow',value:strings(a.addUint(1))});
rows.push({id:'string',value:strings(a.addNumber('2'))});rows.push({id:'null',value:strings(a.addNumber(null))});rows.push({id:'undefined',value:strings(a.addNumber(undefined))});
a.reset(0,0,0);rows.push({id:'int-fraction',value:strings(a.addInt(-1.75))});rows.push({id:'uint-fraction',value:strings(a.addUint(-1.75))});
c.reset(8,0,0);rows.push({id:'inherited',value:strings(c.inherited(0.5))});
a.reset(10,0,0);b.reset(100,0,0);a.target=a;
rows.push({id:'routed',value:strings(a.routed(()=>{a.target=b;return 2;}))});
rows.push({id:'routed-storage',value:strings([a.state()[0],b.state()[0]])});
let effects=0,code=0;a.target=null;try{a.routed(()=>{effects++;return 3;});}catch(e){code=api.as3GetProperty(e,'errorID');}
rows.push({id:'null-receiver',value:[code,effects]});globalThis.result=rows;
