import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain);
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('signals',domain);
 const probe=as3ConstructClass(domain.getDefinition('cases.Parameters'));
 const result=as3CallValue(get(probe,'snapshot'),()=>[]);
 if(get(result,'ready')!==true||get(result,'failure')!=='')throw Error('Probe failed');
 return {rows:get(result,'observations')};
}
