// Host observer adapted from CapturedClassCallbackProbe; all three subjects are emitted unchanged.
const nc=load('nativeClass'),p=load('AS3Property'),errors=load('AS3SourceError'),invoke=load('AS3Invocation');
const get=n=>nc.readNativeClass(load(n)[n],'value');
const ClassCallbacks=get('ClassCallbacks'),First=get('First'),Second=get('Second');
// Host entry uses the common builtin global; observer-global reflection is not compared.
const global=load('AS3ScriptGlobal').getAS3BuiltinScriptGlobal();
const call=(fn,...args)=>invoke.as3CallValue(fn,()=>args,global);
const rows=[],row=(id,value)=>rows.push({id,value});
function failure(fn){try{fn();return [];}catch(e){return errors.isAS3SourceError(e)?[p.as3GetProperty(e,'name'),p.as3GetProperty(e,'errorID')]:[e.name,e.errorID];}}
const subject=new ClassCallbacks();
row('class-local-null',subject.local(null));row('class-local-undefined',subject.local(undefined));row('class-local-source',subject.local(First));row('class-local-builtin',subject.local(Array));
row('class-local-invalid',failure(()=>subject.local({})));row('class-local-function',failure(()=>subject.local(function(){})));
row('class-parameter',[subject.typed()===null,subject.typed(undefined)===null,subject.typed(First)===First]);row('class-parameter-invalid',failure(()=>subject.typed({})));
const factory=subject.factory(First),other=subject.factory(Second),first=call(factory,4.9),second=call(other,5.9);
row('escaped-factory',[first instanceof First,first.value,second instanceof Second,second.value]);row('factory-distinct-identity',factory!==subject.factory(First));
row('callback-length',[invoke.getAS3FunctionLength(factory),invoke.getAS3FunctionLength(subject.defaultFactory(First))]);
const callbacks=subject.changing(First),make=callbacks[0],replace=callbacks[1],read=callbacks[2];
row('captured-before',[call(make) instanceof First,call(read)===First]);
row('captured-replace',[call(replace,Second)===Second,call(read)===Second,call(make) instanceof Second]);
row('captured-failed-replace',[failure(()=>call(replace,{})),call(read)===Second,call(make) instanceof Second]);
row('captured-undefined-raw',[call(replace,undefined)===undefined,call(read)===null]);row('captured-null-construction',failure(()=>call(make)));
row('callback-extra-argument',failure(()=>call(factory,1,2)));row('callback-missing-argument',failure(()=>call(factory)));
const missing=call(factory),extra=call(factory,1,2);row('callback-argument-results',[missing instanceof First,missing.value,extra instanceof First,extra.value]);
const defaultValue=call(subject.defaultFactory(First));row('constructor-default',[defaultValue instanceof First,defaultValue.value]);
const receiver=subject.receiver(),explicit={},direct=call(receiver),called=p.as3CallProperty(receiver,'call',()=>[explicit]),again=call(receiver);
row('callback-receiver',[direct[0],called[0],called[1]===explicit,direct[1]===again[1]]);
const json=subject.json('[{"value":3.9},null,4]',First);row('json-captured-class',[json[0] instanceof First,json[0].value,json[1] instanceof First,json[1].value,json[2]]);
globalThis.result=rows;
