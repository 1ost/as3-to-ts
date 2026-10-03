import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 try{const domain=await session.load('unary',new ApplicationDomain(ApplicationDomain.currentDomain)),Subject=domain.getDefinition('UnarySubject') as any,subject=new Subject();return {rows:[{id:'first',value:subject.values()},{id:'second',value:subject.values()}]};}
 finally{session.retire();}
}
