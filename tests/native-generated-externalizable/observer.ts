import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {IExternalizable} from '@FLASH@/utils/IExternalizable';
import {ByteArray} from '@FLASH@/utils/AS3CanonicalByteArrayReference';
import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3Is,as3As} from '@FLASH@/utils/AS3Type';
export async function run(module){
 const load=async domain=>{const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('contract',domain);return domain;};
 const domain=await load(new ApplicationDomain(ApplicationDomain.currentDomain)),def=n=>domain.getDefinition('externalcontract.'+n);
 const Record=def('Record'),Child=def('Child'),IRecord=def('IRecord'),Consumer=def('Consumer');
 const record=as3ConstructClass(Record,[123]),child=as3ConstructClass(Child,[-456]),bytes=new ByteArray();
 const call=(name,args)=>as3CallValue(get(Consumer,name),()=>args),rows=[],row=(id,value)=>rows.push({id,value});
 row('native-name',IExternalizable.name);
 row('identity',[as3Is(record,IExternalizable),as3Is(record,IRecord),as3Is(child,IExternalizable),as3Is(child,IRecord),call('accept',[record])===record]);
 call('write',[record,bytes]);call('write',[child,bytes]);row('writes',[bytes.length,bytes.position]);bytes.position=0;row('wire-integers',[bytes.readInt(),bytes.readInt()]);
 bytes.position=0;call('read',[child,bytes]);call('read',[record,bytes]);row('reads',[get(child,'value'),get(record,'value'),bytes.position]);
 const fake={readExternal:()=>{},writeExternal:()=>{}};row('structural',[as3Is(fake,IExternalizable),as3As(fake,IExternalizable)===null,as3Is(bytes,IExternalizable)]);
 row('null',[call('accept',[null])===null,call('accept',[undefined])===null]);
 try{call('accept',[fake]);row('wrong','accepted');}catch(e){row('wrong',[get(e,'name'),get(e,'errorID')]);}
 try{call('read',[null,bytes]);row('null-call','accepted');}catch(e){row('null-call',[get(e,'name'),get(e,'errorID')]);}
 const sibling=await load(new ApplicationDomain(ApplicationDomain.currentDomain)),inherited=await load(new ApplicationDomain(domain));
 const siblingInterface=sibling.getDefinition('externalcontract.IRecord'),siblingClass=sibling.getDefinition('externalcontract.Record'),instance=as3ConstructClass(siblingClass);
 const domainChecks=[siblingInterface!==IRecord,siblingClass!==Record,as3Is(instance,siblingInterface),!as3Is(instance,IRecord),as3Is(instance,IExternalizable),inherited.getDefinition('externalcontract.Record')===Record];
 if(domainChecks.some(v=>!v))throw Error('Interface domain mismatch');return {rows,domainChecks};
}
