// Observer only; Owner is emitted from the complete authenticated source.
const Owner=load('nativeClass').readNativeClass(load('Owner').Owner);
const bytes=()=>{const b=new api.ByteArray();b.writeUTFBytes('ABC');b.position=1;return b;};
const hex=b=>Array.from(new Uint8Array(b.buffer),v=>v.toString(16).padStart(2,'0')).join('');
const rows=[],row=(id,value)=>rows.push({id,value}),errorState=e=>[api.as3GetProperty(e,'name'),api.as3GetProperty(e,'errorID')];
for(const mode of ['direct','viaApply','viaCall']){
 const b=bytes(),owner=new Owner(b);owner[mode]('deflate');
 row(mode,[hex(b),b.position,owner.effects]);owner.expand();row(mode+'-expand',[hex(b),b.position]);
 const absent=new Owner(null);let error=null;try{absent[mode]('deflate');}catch(e){error=errorState(e);}
 row(mode+'-null',[error,absent.effects]);
}
let b=bytes(),owner=new Owner(b),fn=owner.closure(),other=bytes();api.as3CallProperty(fn,'apply',()=>[other,['deflate']]);
row('closure',[fn===owner.closure(),hex(b),b.position,hex(other),other.position]);
b=bytes();owner=new Owner(b);owner.raw();row('raw',[hex(b),b.position]);
b=bytes();owner=new Owner(null);owner.parameter(b);row('parameter',[hex(b),b.position]);
let error=null;try{owner.parameter(null);}catch(e){error=errorState(e);}row('parameter-null',error);
b=bytes();owner=new Owner(b);owner.replace();row('receiver-before-argument',[hex(b),b.position,owner.effects]);
error=null;try{owner.closure();}catch(e){error=errorState(e);}row('replaced-null',error);
owner=new Owner(null);owner.own();row('own',owner.effects);
// Host-shaped objects and unrelated native methods never acquire authority.
for(const forged of [{compress(){}},Object.create(api.ByteArray.prototype)]){
 let rejected=false;try{api.as3GetByteArrayCompressionMethod(forged,'compress');}catch(e){rejected=e instanceof TypeError;}
 if(!rejected)throw Error('forged native receiver accepted');
}
let rejected=false;try{api.as3GetByteArrayCompressionMethod(bytes(),'clear');}catch(e){rejected=e instanceof TypeError;}
if(!rejected)throw Error('unqualified method accepted');
const tampered=bytes();tampered.compress=function(){};rejected=false;
try{api.as3GetByteArrayCompressionMethod(tampered,'compress');}catch(e){rejected=e instanceof TypeError;}
if(!rejected)throw Error('replaced closure accepted');
globalThis.result=rows;
