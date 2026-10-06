import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
export async function run(module:NativeSourceClassModule){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain);
 await createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1}).load('own-class-cast',domain);
 const c=as3ConstructClass(domain.getDefinition('cases.OwnClassCastProbe'),[]);
 const result=as3CallValue(get(c,'snapshot'),()=>[],c);
 return get(result,'observations');
}
