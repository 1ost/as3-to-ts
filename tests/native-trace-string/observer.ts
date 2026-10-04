import {ErrorEvent} from '@FLASH@/utils/AS3CanonicalErrorEventReference';
import {installNativeTraceHost} from '@FLASH@/debug/trace';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
export async function run(nativeSourceClassModule:any){
 const session=createNativeSourceClassLoadingSession({resolve:()=>nativeSourceClassModule,maxModules:1});
 let output=''; const lease=installNativeTraceHost({write(text){output+=text;}});
 try{
 const domain=await session.load('trace',new ApplicationDomain(ApplicationDomain.currentDomain)),Subject=domain.getDefinition('TraceSubject') as any,rows:any[]=[];
 const subject=new Subject();
 subject.artwork(new ErrorEvent('error',false,false,'missing.png'));
 subject.scalar(null,null);subject.scalar(undefined,'text');subject.scalar(8,'last');
 rows.push({id:'coercion-order',value:subject.coercion()});
 try{subject.interrupted();}catch(e){rows.push({id:'interrupted',value:[e.name,e.message]});}
 return {rows,output};
 }finally{lease.dispose();session.retire();}
}
