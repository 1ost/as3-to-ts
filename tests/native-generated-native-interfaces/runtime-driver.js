// Observer only: both complete subject classes are emitted from retained AIR source.
const nc=load('nativeClass'),klass=name=>nc.readNativeClass(load(name)[name]);
const Reader=klass('Reader'),Peer=klass('Peer');
const rows=[],add=(id,value)=>rows.push({id,value});
const error=e=>[api.as3GetProperty(e,'name'),api.as3GetProperty(e,'errorID')];
const reader=new Reader(),peer=new Peer(),bytes=new api.ByteArray();
add('defaults',[reader.input===null,reader.output===null,reader.calls]);
add('identity',[reader.isInput(bytes),reader.isOutput(bytes),reader.isInput({}),reader.isOutput({}),reader.isInput(null)]);
add('casts',[reader.castInput(bytes)===bytes,reader.castOutput(bytes)===bytes,reader.castInput({})===null,reader.castOutput({})===null]);
add('storage',[reader.keep(bytes)===bytes,reader.keepOutput(bytes)===bytes,reader.input===bytes,reader.output===bytes]);
peer.write(reader,bytes);bytes.position=0;add('write',[bytes.readUnsignedByte(),peer.read(reader,bytes),reader.calls,bytes.position]);
add('empty',[reader.own(bytes),reader.calls]);add('null',[reader.own(null),reader.calls]);
const fn=reader.closure();add('closure',[fn===peer.closure(reader),api.as3GetProperty(fn,'length')]);
try{fn({});add('bad-input','accepted');}catch(e){add('bad-input',[...error(e),reader.calls]);}
const write=reader.writeOwn;try{write({});add('bad-output','accepted');}catch(e){add('bad-output',[...error(e),reader.calls]);}
const keep=reader.keep;try{keep({});add('bad-storage','accepted');}catch(e){add('bad-storage',[...error(e),reader.input===bytes]);}
try{fn();add('arity','accepted');}catch(e){add('arity',[...error(e),reader.calls]);}
add('undefined',[fn(undefined),reader.calls,keep(undefined)===null,reader.input===null]);
const fresh=new api.ByteArray();fresh.writeByte(7);fresh.position=0;add('fresh',[peer.read(new Reader(),fresh),fresh.position,reader.calls]);
let guards=0;
function rejected(fn){let caught=false;try{fn();}catch(e){caught=true;}if(!caught)throw Error('invalid native interface accepted');guards++;}
for(const token of [{name:'flash.utils::IDataInput'},function Fake(){},api.defineAS3Interface('wrong::Input')])
 rejected(()=>createDomainLoader({IDataInput:token})('declarationDomain'));
rejected(()=>reader.own(Object.create(api.ByteArray.prototype)));
rejected(()=>reader.keep({constructor:api.ByteArray,name:'flash.utils::ByteArray'}));
// A genuinely registered same-name token still differs from the canonical export.
const isolated=createDomainLoader({IDataInput:api.defineAS3Interface('flash.utils::IDataInput')});
const isolatedReader=isolated('nativeClass').readNativeClass(isolated('Reader').Reader);
rejected(()=>new isolatedReader().keep(bytes));
if(guards!==6)throw Error('native interface guard count');
globalThis.result=rows;
