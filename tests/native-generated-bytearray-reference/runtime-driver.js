// Observer only: the complete Reader class is emitted from retained AIR source.
const Reader=load('nativeClass').readNativeClass(load('Reader').Reader);
const rows=[],add=(id,value)=>rows.push({id,value});
const r=new Reader(),bytes=new api.ByteArray();bytes.writeByte(7);
add('identity',[r.cast(bytes)===bytes,r.matches(bytes),bytes.length,bytes.position]);
const values=[null,undefined,0,7,'bad',true,{},[],function(){}];
values.forEach((value,i)=>add('other-'+i,[r.cast(value)===null,r.matches(value)]));
let conversions=0;function convert(){conversions++;return new api.ByteArray();}
const object={valueOf:convert,toString:convert};
add('no-conversion',[r.cast(object)===null,r.matches(object),conversions]);
add('once',[r.castNext(bytes)===bytes,r.matchesNext(bytes),r.calls]);
add('once-null',[r.castNext(null)===null,r.matchesNext(undefined),r.calls]);
const map=new api.Dictionary(),key={};api.as3SetProperty(map,key,bytes);api.as3SetProperty(map,17,object);
add('dictionary',[r.entry(map,key)===bytes,r.entry(map,17)===null,r.entry(map,'missing')===null,conversions]);
add('fresh',[new Reader().cast(bytes)===bytes,new Reader().matches(new api.ByteArray()),r.calls]);
// Host-only adversarial controls: mutable prototypes or names cannot mint instances.
for(const fake of [Object.create(api.ByteArray.prototype),{constructor:api.ByteArray,name:'flash.utils::ByteArray'}]){
 if(r.cast(fake)!==null||r.matches(fake))throw Error('forged ByteArray accepted');
}
globalThis.result=rows;
