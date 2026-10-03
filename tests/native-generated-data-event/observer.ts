import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {observe} from '@OBSERVE@';
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 const loaded=await session.load('data-event-source',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Subject:any=loaded.getDefinition('model.DataEventUse');
 try{return observe(new Subject());}finally{session.retire();}
}
