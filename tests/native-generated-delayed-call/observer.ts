import {FlashTweenRuntime} from '@ENGINE@/src/extensions/greensock/FlashTweenRuntime';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
export async function run(module:NativeSourceClassModule,mutation?:string){
 let now=0,token=0;const runtime=new FlashTweenRuntime(()=>now),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 const originalDelay=FlashTweenRuntime.prototype.delayedCall,originalKill=FlashTweenRuntime.prototype.killTweensOf;
 if(mutation==='zero-delay')FlashTweenRuntime.prototype.delayedCall=function(_delay,callback,params,useFrames){return originalDelay.call(this,0,callback,params,useFrames);};
 if(mutation==='ignore-cancellation')FlashTweenRuntime.prototype.killTweensOf=function(){};
 try{
  const domain=await session.load('probe',new ApplicationDomain(ApplicationDomain.currentDomain)),Subject=domain.getDefinition('DelayedSubject') as any,a=new Subject(),b=new Subject(),rows:any[]=[];
  const row=(id:string,value:any)=>rows.push({id,value}),step=(seconds:number)=>{now=seconds/0.001;runtime.advance(++token);};
  a.start(.25);b.start(.5);row('deferred',[a.calls,b.calls]);row('argument-order',a.evaluations.concat());
  step(.249);row('before-first',[a.calls,b.calls]);step(.25);row('first-bound-receiver',[a.calls,b.calls]);step(.5);row('second-bound-receiver',[a.calls,b.calls]);
  a.start(0);row('zero-deferred',a.calls);step(.501);row('zero-delivered',a.calls);a.start(.25);a.cancel();step(1);row('cancelled-method-closure',a.calls);
  row('single-argument-evaluation',[a.evaluations.concat(),b.evaluations.concat()]);return {rows};
 }finally{FlashTweenRuntime.prototype.delayedCall=originalDelay;FlashTweenRuntime.prototype.killTweensOf=originalKill;session.retire();runtime.dispose();}
}
