// Observer only; Counter comes from the complete authenticated AS3 subject.
const Counter=load('nativeClass').readNativeClass(load('Counter').Counter);
const rows=[],row=(id,value)=>rows.push({id,value});
const cases=[[1,1,1.5],[2147483647,4294967295,0],[-2147483648,0,-2.5],[-1,4294967294,9007199254740992],[2147483646,0,-0.5]];
cases.forEach((values,k)=>{
 const counter=new Counter(...values);
 row('int-'+k,counter.integers());row('uint-'+k,counter.unsigned());
 row('number-'+k,counter.numbers());row('bare-'+k,counter.bare());
});
const a=new Counter(0,0,0),b=new Counter(2147483647,0,0);
row('other',a.other(b));
try {a.other(null);row('null','accepted');}
catch(error){row('null',[api.as3GetProperty(error,'name'),api.as3GetProperty(error,'errorID')]);}
const LeafCounter=load('nativeClass').readNativeClass(load('LeafCounter').LeafCounter);
cases.forEach((values,k)=>row('inherited-'+k,new LeafCounter(...values).inherited()));
const left=new LeafCounter(0,0,0),right=new LeafCounter(2147483647,4294967295,1.5);
row('peer',left.peer(right));
try{left.peer(null);row('peer-null','accepted');}catch(error){row('peer-null',[api.as3GetProperty(error,'name'),api.as3GetProperty(error,'errorID')]);}
globalThis.result=rows;
