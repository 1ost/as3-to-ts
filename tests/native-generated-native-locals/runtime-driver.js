const nc=load('nativeClass'),p=load('AS3Property'),errors=load('AS3SourceError');
const NativeLocals=nc.readNativeClass(load('NativeLocals').NativeLocals,'value');
const ByteArray=load('ByteArray').ByteArray;
const rows=[],row=(id,value)=>rows.push({id,value});
function failure(fn){try{fn();return [];}catch(e){return errors.isAS3SourceError(e)?[p.as3GetProperty(e,'name'),p.as3GetProperty(e,'errorID')]:[e.name,e.errorID];}}
const first=new ByteArray(),second=new ByteArray(),subject=new NativeLocals();
row('constructor-null',subject.initial);
row('constructor-undefined',new NativeLocals(undefined).initial);
row('constructor-instance',new NativeLocals(first).initial);
row('constructor-invalid',failure(()=>new NativeLocals({})));
row('function-defaults',subject.defaults());
row('assign-null',subject.assign(null));
row('assign-undefined-raw',subject.assign(undefined));
row('assign-instance',subject.assign(first));
for(const [id,value] of [['object',{}],['array',[]],['number',0],['string',''],['class',ByteArray],['other-native',new Date()]])row('reject-'+id,subject.failed(value));
let conversions=0;
const object={valueOf(){conversions++;return first;},toString(){conversions++;return 'bytes';}};
row('reference-does-not-convert',[subject.failed(object),conversions]);
row('repeated-declaration',subject.repeated(first,second));
row('captured-local',subject.captured(first,second));
row('enumerate-empty',subject.enumerate([]));
row('enumerate-nullish',subject.enumerate([first,null,undefined]));
row('enumerate-invalid',failure(()=>subject.enumerate([first,{}])));
// A host-forged prototype is not a constructed native instance (not an AIR row).
if(JSON.stringify(subject.failed(Object.create(ByteArray.prototype)))!==JSON.stringify([true,'TypeError',1034]))throw Error('Forged ByteArray instance accepted');
globalThis.result=rows;
