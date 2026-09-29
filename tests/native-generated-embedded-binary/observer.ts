import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import * as m0 from '@FLASH@/utils/AS3EmbeddedByteArrayDomain';
import * as m1 from '@FLASH@/utils/AS3CanonicalByteArrayReference';
import * as m2 from '@FLASH@/utils/IDataInput';
import * as m3 from '@FLASH@/utils/IDataOutput';
import * as m4 from '@FLASH@/utils/AS3Type';
import * as m5 from '@FLASH@/utils/AS3Class';
import * as m6 from '@FLASH@/utils/AS3Property';
import * as m7 from '@FLASH@/utils/AS3XML';
import * as m8 from '@FLASH@/utils/describeType';
import * as m9 from '@FLASH@/utils/getQualifiedSuperclassName';
import * as m10 from '@FLASH@/utils/FlashTypeMetadata';
const api=Object.assign({},m0,m1,m2,m3,m4,m5,m6,m7,m8,m9,m10);
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const domain=await session.load('embedded',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Assets=domain.getDefinition('embeddedbytes.Assets') as any;
const rows:any[]=[],add=(id:string,value:any)=>rows.push({id,value}),construct=(Kind:any,args:any[]=[])=>api.as3ConstructClass(Kind,args);
const Kind=Assets.kind(),Other=Assets.otherKind();
const Copy=Assets.copyKind();

const fresh=()=>Assets.create(),data=(value:any)=>{const saved=value.position,result=[];value.position=0;while(value.bytesAvailable)result.push(value.readUnsignedByte());value.position=saved;return result;};
const errorValue=(e:any)=>[api.as3GetProperty(e,'name'),api.as3GetProperty(e,'errorID')];
const a=fresh(),b=fresh(),c=construct(Other);
add('defaults',[a.length,a.position,a.bytesAvailable,a.endian,a.objectEncoding]);add('bytes',data(a));
add('types',[api.as3Is(a,api.ByteArray),api.as3Is(a,api.IDataInput),api.as3Is(a,api.IDataOutput),api.as3Is(a,Kind),api.as3Is(a,Other),api.as3Is(c,Other),api.as3Is(c,Kind)]);
add('classes',[Kind===Kind,Kind===Other,a.constructor===Kind,c.constructor===Other]);
add('base',api.getQualifiedSuperclassName(a));
a.position=2;a.writeByte(9);a.endian='littleEndian';a.objectEncoding=0;add('mutated',[a.position,a.endian,a.objectEncoding,data(a)]);
add('independent',[a!==b,b!==c,b.position,b.endian,b.objectEncoding,data(b),data(c)]);
a.clear();add('clear',[a.length,a.position,b.length,fresh().length]);
for(const [i,args]of [[],[undefined],[null],[7],[1,2]].entries()){try{const v=construct(Kind,args);add('arity:'+i,[v.length,v.position]);}catch(e){add('arity:'+i,errorValue(e));}}
add('cast',[api.as3CallClass(Kind,[b])===b,api.as3CallClass(Kind,[null])===null]);
try{api.as3CallClass(Kind,[new api.ByteArray()]);add('wrong-cast','accepted');}catch(e){add('wrong-cast',errorValue(e));}
const xml=Assets.config(),attr=(node:any,name:string)=>api.as3XMLListString(api.as3XMLAttribute(node,name));
add('config',[api.as3XMLNameString(xml),attr(xml,'enabled'),attr(api.as3XMLChildNamed(xml,'asset'),'className'),attr(api.as3XMLChildNamed(xml,'menuButton'),'loadAttempts')]);
b.position=b.length;try{b.readByte();add('eof','accepted');}catch(e){add('eof',[...errorValue(e),b.position]);}
const copy=construct(Copy);add('identical-file',[Kind===Copy,api.as3Is(copy,Kind),data(copy)]);
b.length=4;b.position=1;b.writeByte(22);add('shrink',[b.length,b.position,data(b),data(c),data(fresh())]);
b.length=9;b.position=2;b.writeByte(23);add('regrow',[data(b),data(c),data(fresh())]);
const grow=fresh();grow.position=grow.length;grow.writeByte(24);grow.position=0;grow.writeByte(25);add('append',[grow.length,data(grow),data(c),data(fresh())]);
const same=fresh();same.length=same.length;same.position=0;same.writeByte(26);add('same-length',[data(same),data(c),data(fresh()),data(copy)]);
const zero=fresh();zero.length=0;zero.length=9;zero.position=1;zero.writeByte(27);add('zero-length-regrow',[data(zero),data(c),data(fresh())]);
const cleared=fresh();cleared.clear();cleared.length=9;cleared.position=1;cleared.writeByte(28);add('clear-regrow',[data(cleared),data(c),data(fresh())]);
const shortened=fresh();shortened.length=3;shortened.position=8;shortened.writeByte(29);add('write-after-shrink',[data(shortened),data(c)]);
const Init=domain.getDefinition('embeddedinit.Assets') as any;
const initialization=Init.rows.concat(),InitKind=Init.kind(),ia=Init.create(),ib=api.as3ConstructClass(InitKind);
initialization.push({id:'initialized',value:[api.as3AsClass(InitKind)!==null,api.as3Is(ia,InitKind),ia.length,ia.position,ia.readUnsignedByte(),ib.readUnsignedByte()]});
ia.position=0;ia.writeByte(42);ib.position=0;initialization.push({id:'shared',value:[ia!==ib,ib.readUnsignedByte(),Init.create().readUnsignedByte()]});
initialization.push({id:'external',value:[api.as3GetProperty(Init,'Data')===undefined,api.as3GetProperty(Init,'Data')===null]});
const sibling=await session.load('sibling',new ApplicationDomain(ApplicationDomain.currentDomain));
const Sibling=sibling.getDefinition('embeddedbytes.Assets') as any;
const domainChecks=[Sibling!==Assets,Sibling.kind()!==Kind,Sibling.create().readUnsignedByte()===0];
if(!domainChecks.every(Boolean))throw Error('generated domain identity or storage leak');
session.retire();
return {rows,initialization,domainChecks,classReflection:api.describeRegisteredFlashType(Kind).reflectionAuthority,instanceReflection:api.describeRegisteredFlashType(c).reflectionAuthority};

}
