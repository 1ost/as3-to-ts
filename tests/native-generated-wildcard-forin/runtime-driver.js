// Separate host observer; Enumeration and Sealed are emitted without source edits.
const nc=load('nativeClass'),p=load('AS3Property'),errors=load('AS3SourceError'),invoke=load('AS3Invocation');
const Enumeration=nc.readNativeClass(load('Enumeration').Enumeration),Sealed=nc.readNativeClass(load('Sealed').Sealed);
const global=load('AS3ScriptGlobal').getAS3BuiltinScriptGlobal(),subject=new Enumeration(),rows=[],row=(id,value)=>rows.push({id,value});
const object=values=>Object.assign(load('AS3DynamicObject').as3CreateDynamicObject(),values);
const ordered=value=>value.sort((a,b)=>String(a[1])<String(b[1])?-1:String(a[1])>String(b[1])?1:0);
function failure(fn){try{fn();return [];}catch(e){return errors.isAS3SourceError(e)?[p.as3GetProperty(e,'name'),p.as3GetProperty(e,'errorID')]:[e.name,e.errorID];}}
row('empty-null',subject.keys(null));row('empty-undefined',subject.keys(undefined));row('empty-scalars',[subject.keys(17),subject.keys('abc'),subject.keys(true)]);row('empty-sealed',subject.keys(new Sealed()));
row('array-numeric-keys',subject.keys([10,20,30]));const sparse=[];sparse[2]=4;sparse.extra=5;row('sparse-extra',ordered(subject.keys(sparse)));
row('object-key-types',ordered(subject.keys({'0':1,'01':2,'268435455':3,'268435456':4,name:5})));
row('empty-keeps-target',[subject.last(null),subject.last({}),subject.last(new Sealed())]);row('last-numeric',[typeof subject.last([8]),subject.last([8])]);
const child={value:7},source={child,value:3},target=object({keep:9});row('copy-identity',[subject.copy(source,target)===target,target.child===child,target.value,target.keep]);
const sealed=new Sealed();row('copy-sealed',[subject.copy({value:4.9},sealed)===sealed,sealed.value]);row('copy-sealed-unknown',failure(()=>subject.copy({unknown:1},sealed)));row('copy-null-source',subject.copy(null,target)===target);
const callback=subject.captured(sparse);row('captured-keys',ordered(invoke.as3CallValue(callback,()=>[],global)));row('captured-repeat',ordered(invoke.as3CallValue(callback,()=>[],global)));
row('loop-flow',subject.flow([10,20,30,40]));row('stable-receiver',subject.stable([10,20,30],{changed:1}));
globalThis.result=rows;
