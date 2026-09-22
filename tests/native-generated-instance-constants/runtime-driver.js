// Separate host observer. All five captured subject classes are emitted unchanged.
const nc=load('nativeClass'),p=load('AS3Property');
const cls=name=>nc.readNativeClass(load(name)[name]);
const Values=cls('Values'),Writer=cls('Writer'),Trace=cls('Trace'),Derived=cls('Derived');
const v=new Values(),w=new Writer(),rows=[],row=(id,value)=>rows.push({id,value});
const failure=fn=>{try{fn();return [];}catch(e){return [e.name,e.errorID];}};
row('values',v.read());Trace.events=[];const d=new Derived();row('construction-order',Trace.events);
row('inherited-read',[d.base,d.derived,d.before]);
row('write-own',failure(()=>w.write(v,'i',8)));row('write-inherited',failure(()=>w.write(d,'base',8)));
row('delete',[w.remove(v,'i'),w.remove(d,'base')]);row('unchanged',[v.i,d.base]);
row('enumeration',Array.from(p.as3EnumerableKeys(v)));
row('own-properties',[p.as3HasOwnProperty(v,'i'),p.as3HasOwnProperty(d,'base'),p.as3HasOwnProperty(d,'derived')]);
const other=new Values();row('second-instance',[other!==v,other.read()]);globalThis.result=rows;
