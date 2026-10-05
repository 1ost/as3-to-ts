import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue,getAS3FunctionIntrinsic} from '@FLASH@/utils/AS3Invocation';
import {QName} from '@FLASH@/utils/QName';
import {as3Is} from '@FLASH@/utils/AS3Type';
export async function run(module:NativeSourceClassModule){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('private-namespace',domain);
 const invoke=(o:any,n:any,...args:any[])=>as3CallValue(get(o,n),()=>args,o),Factory=domain.getDefinition('client.Factory'),Base:any=domain.getDefinition('model.Base'),rows:any[]=[],row=(id:string,value:any)=>rows.push({id,value}),read=new QName('urn:op2:private-helper','read');
 const a=invoke(Factory,'create'),b=invoke(Factory,'create'),base=new Base();
 row('reads',[invoke(a,'explicitRead'),invoke(a,'openedRead'),invoke(a,'openedThis'),invoke(a,'otherRead',base),invoke(a,'otherRead',b),invoke(a,'publicRead')]);
 invoke(a,'change',12);row('write',[invoke(a,'explicitRead'),invoke(a,'openedRead'),invoke(a,'openedThis'),invoke(b,'explicitRead'),invoke(base,read)]);
 const held:any=get(a,read);row('closure',[as3CallValue(held,()=>[]),held===get(a,read),as3CallValue(getAS3FunctionIntrinsic(held,'call'),()=>[b])]);
 row('type',[as3Is(a,Base),as3Is(b,Base),as3Is(base,Base),a===b]);row('private-members',invoke(a,'privateValues'));invoke(a,'setExtra',9);row('private-state',[invoke(a,'privateValues'),invoke(b,'privateValues')]);session.retire();return rows;
}
