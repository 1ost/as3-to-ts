// Separate observer for the two complete emitted AIR subjects.
const nc=load('nativeClass'),klass=name=>nc.readNativeClass(load(name)[name]);
const Boundary=klass('ErrorBoundary'),Target=klass('ConstructorTarget');
const rows=[],row=(id,value)=>rows.push({id,value}),subject=new Boundary();
const get=(object,key)=>api.as3GetProperty(object,key);
const kind=(value,name)=>api.as3IsSourceErrorInstance(value)&&api.sourceErrorParent(value)===api.getAS3SourceErrorPrototype(name);
const describe=(value,message)=>[get(value,'name'),get(value,'errorID'),get(value,'message')===message,api.as3IsSourceErrorInstance(value),kind(value,'ArgumentError'),kind(value,'ReferenceError')];
row('missing',subject.missing());row('extra',subject.extra());
subject.fixed(7);
row('after-valid',[subject.missing(),subject.extra(),subject.entries]);
for(const [id,args] of [['constructor-missing',[]],['constructor-extra',[1,2]]]){
 try{new Target(...args);row(id,'accepted');}
 catch(e){row(id,[get(e,'name'),get(e,'errorID'),api.as3IsSourceErrorInstance(e),kind(e,'ArgumentError')]);}
}
row('constructor-valid',new Target(7).value);
const values=[['string','message',7.9],['null',null,null],['undefined',undefined,undefined],['number',17,'12'],['object',api.as3CreateDynamicObject(),-2.9]];
for(const name of ['Error','Argument','Reference'])for(const [label,message,id] of values){
 row(name+'-one-'+label,describe(subject['direct'+name+'1'](message),message));
 row(name+'-new-'+label,describe(subject['new'+name](message,id),message));
}
const message=api.as3CreateDynamicObject();
row('throw-direct',subject.throwDirect(message));row('throw-new',subject.throwNew(message));
for(const [label,value] of [['closure',subject.fixed],['class',Target],['null',null],['undefined',undefined],['array',[]],['object',api.as3CreateDynamicObject()],['number',7]]){
 row('local-'+label,subject.local(value));
 try{const fn=subject.initialized(value);row('initialized-'+label,[fn===value,fn===null]);}
 catch(e){row('initialized-'+label,[get(e,'name'),get(e,'errorID'),api.as3IsSourceErrorInstance(e),kind(e,'TypeError')]);}
}
globalThis.result=rows;
