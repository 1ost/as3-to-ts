// Separate host observer; complete Reader and Record sources are emitted.
const nc=load('nativeClass'),p=load('AS3Property'),errors=load('AS3SourceError'),inv=load('AS3Invocation');
const Reader=nc.readNativeClass(load('Reader').Reader),Record=nc.readNativeClass(load('Record').Record),r=new Reader(),s=new Record();
const object=values=>Object.assign(load('AS3DynamicObject').as3CreateDynamicObject(),values);
const info=e=>errors.isAS3SourceError(e)?[p.as3GetProperty(e,'name'),p.as3GetProperty(e,'errorID')]:[e.name,e.errorID];
const failure=fn=>{try{fn();return [];}catch(e){return info(e);}},rows=[],row=(id,value)=>rows.push({id,value}),o=object({value:3}),a=[4,5];
row('object-own',r.objectRead(o,'value'));row('object-missing',r.objectRead(o,'missing')===undefined);row('sealed-own',r.objectRead(s,'value'));row('sealed-missing',failure(()=>r.objectRead(s,'missing')));
row('null-object',failure(()=>r.objectRead(null,'value')));row('undefined-object',failure(()=>r.objectRead(undefined,'value')));row('undefined-wildcard',failure(()=>r.wildcardRead(undefined,'value')));
row('array-reads',[r.objectRead(a,0),r.objectRead(a,'length'),r.objectRead(a,9)===undefined]);row('string-reads',[failure(()=>r.objectRead('abc',1)),r.objectRead('abc','length')]);
const f=r.objectRead(s,'method');row('bound-method',[f(),f===r.objectRead(s,'method')]);row('ignored-catch',[r.ignored(o),r.ignored(a),r.ignored(s),r.ignored(null)]);
let events=[];const key=function(){events.push('key');return 'value';};
row('key-once',[r.keyCall(o,key),events]);events=[];const fv=failure(()=>r.keyCall(null,key));row('null-key-order',[fv,events]);
const keyObject={toString(){events.push('convert');return 'value';}};events=[];row('key-coercion',[r.objectRead(o,keyObject),events]);events=[];const err=failure(()=>r.objectRead(null,keyObject));row('null-key-coercion',[err,events]);
globalThis.result=rows;
