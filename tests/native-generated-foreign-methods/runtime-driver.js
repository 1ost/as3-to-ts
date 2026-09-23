// Observer only: both classes come from their complete authenticated AS3 sources.
const Target=load('nativeClass').readNativeClass(load('Target').Target);
const Owner=load('nativeClass').readNativeClass(load('Owner').Owner);
const rows=[],row=(id,value)=>rows.push({id,value});
const target=new Target(),owner=new Owner(target);
row('invoke',owner.invoke(3));row('parameter',owner.parameter(target));
row('closures',owner.closures());row('ordered',[owner.ordered(),owner.effects]);row('calls',target.calls);
const absent=new Owner(null),errorState=e=>[api.as3GetProperty(e,'name'),api.as3GetProperty(e,'errorID')];
try{absent.ordered();throw Error('accepted null');}catch(error){row('null-ordered',[...errorState(error),absent.effects]);}
try{owner.parameter(null);throw Error('accepted null');}catch(error){row('null-parameter',errorState(error));}
const other=new Target(),switching=new Owner(other);
row('receiver-before-argument',[switching.receiverBeforeArgument(),switching.effects,other.calls]);
try{switching.invoke(1);throw Error('accepted replaced null');}catch(error){row('receiver-replaced',errorState(error));}
globalThis.result=rows;
