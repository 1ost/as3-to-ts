import {Timer} from '@FLASH@/utils/Timer';
import {ILaya} from '@ENGINE@/src/layaAir/ILaya';
import {Timer as LayaTimer} from '@ENGINE@/src/layaAir/laya/utils/Timer';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
export async function run(nativeSourceClassModule:any){
 const previous=ILaya.systemTimer;ILaya.systemTimer=new LayaTimer(false);
 const session=createNativeSourceClassLoadingSession({resolve:()=>nativeSourceClassModule,maxModules:1});
 const timer=new Timer(60000,2);
 try{
 const domain=await session.load('timers',new ApplicationDomain(ApplicationDomain.currentDomain)),Subject=domain.getDefinition('TimerSubject') as any,s=new Subject(timer),rows:any[]=[];
 s.begin();rows.push({id:'field-start',value:timer.running});s.end();rows.push({id:'field-stop',value:timer.running});s.begin();s.clear();rows.push({id:'field-reset',value:[timer.running,timer.currentCount]});
 s.parameter(timer);rows.push({id:'parameter',value:[timer.running,timer.currentCount]});s.local();rows.push({id:'local',value:timer.running});
 const a=s.closures(),b=s.closures();rows.push({id:'closure-identity',value:[a[0]===b[0],a[1]===b[1],a[2]===b[2]]});
 a[0].call({});rows.push({id:'closure-start',value:timer.running});a[1].apply({},[]);rows.push({id:'closure-stop',value:timer.running});a[0]();a[2]();rows.push({id:'closure-reset',value:[timer.running,timer.currentCount]});
 rows.push({id:'private',value:s.own()});const nil=new Subject(null);
 try{nil.begin();}catch(e){rows.push({id:'null-call',value:[e.name,e.errorID]});}try{nil.closures();}catch(e){rows.push({id:'null-get',value:[e.name,e.errorID]});}
 s.intrinsic();rows.push({id:'intrinsic',value:timer.running});
 try{s.parameter(null);}catch(e){rows.push({id:'null-parameter',value:[e.name,e.errorID]});}
 try{new Subject({});}catch(e){rows.push({id:'invalid-constructor',value:[e.name,e.errorID]});}
 return {rows};
 }finally{timer.stop();session.retire();ILaya.systemTimer=previous;}
}
