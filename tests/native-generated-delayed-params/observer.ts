import {FlashTweenRuntime} from '@ENGINE@/src/extensions/greensock/FlashTweenRuntime';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
export async function run(module:NativeSourceClassModule,mutation?:string){
 let now=0,token=0;const runtime=new FlashTweenRuntime(()=>now),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 const originalDelay=FlashTweenRuntime.prototype.delayedCall,originalKill=FlashTweenRuntime.prototype.killTweensOf;
 if(mutation==='zero-delay')FlashTweenRuntime.prototype.delayedCall=function(_delay,callback,params,useFrames){return originalDelay.call(this,0,callback,params,useFrames);};
 if(mutation==='ignore-cancellation')FlashTweenRuntime.prototype.killTweensOf=function(){};
 if(mutation==='copy-params')FlashTweenRuntime.prototype.delayedCall=function(delay,callback,params,useFrames){return originalDelay.call(this,delay,callback,params?.slice(),useFrames);};
 if(mutation==='erase-params')FlashTweenRuntime.prototype.delayedCall=function(delay,callback,params,useFrames){return originalDelay.call(this,delay,callback,params?.map(()=>null),useFrames);};
 try{
  const domain=await session.load('probe',new ApplicationDomain(ApplicationDomain.currentDomain)),Subject=domain.getDefinition('DelayedParamsSubject') as any,a=new Subject(),b=new Subject(),rows:any[]=[];
  const row=(id:string,value:any)=>rows.push({id,value}),step=(seconds:number)=>{now=seconds/0.001;runtime.advance(++token);};
  let args:any[]=['old',1];a.start(.25,args);b.start(.5,['other',2]);
  row('deferred',[a.calls,b.calls]);row('argument-order',a.evaluations.concat());
  args[0]='changed';args[1]=7;args=['replacement',99];
  step(.249);row('before-first',[a.calls,b.calls]);step(.25);row('retained-array-and-receiver',[a.calls,b.calls,a.received.concat()]);
  step(.5);row('second-receiver',b.received.concat());
  a.start(0,['zero',3]);row('zero-deferred',a.calls);step(.501);row('zero-delivered',a.received.concat());
  a.start(.25,['cancel',4]);a.cancel();step(1);row('cancelled-method-closure',a.calls);
  a.start(.1,null);step(1.101);row('null-params',a.received.concat());
  a.start(.1,[]);step(1.202);row('empty-params',a.received.concat());
  a.omitted(.1);step(1.303);row('omitted-params',a.received.concat());
  row('single-evaluation',[a.evaluations.concat(),b.evaluations.concat()]);
  const item={label:'before'},source=[item];Subject.items=[];
  Subject.startItem(.1,source,0);source[0]={label:'replaced'};item.label='after';
  row('static-deferred',Subject.items.length);step(1.404);
  row('literal-element-capture',[Subject.items.length,Subject.items[0]===item,Subject.items[0]?.label??null]);
  return {rows};
 }finally{FlashTweenRuntime.prototype.delayedCall=originalDelay;FlashTweenRuntime.prototype.killTweensOf=originalKill;session.retire();runtime.dispose();}
}
