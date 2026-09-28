import {FlashTweenRuntime} from '@ENGINE@/src/extensions/greensock/FlashTweenRuntime';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
export async function run(module:NativeSourceClassModule) {
 let now=0,token=0;const runtime=new FlashTweenRuntime(()=>now);
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 try {
  const domain=await session.load('probe',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Probe=domain.getDefinition('TweenControls') as any,a=new Probe(),b=new Probe(),rows:any[]=[];
  const sample=(p:any)=>{const calls=p.calls;rows.push([p.currentRatio,p.active()]);if(p.calls!==calls+1)throw Error('query target evaluated incorrectly');};
  const stop=(p:any)=>{const calls=p.calls;p.stop();if(p.calls!==calls+1)throw Error('cancel target evaluated incorrectly');};
  const at=(time:number)=>{now=time;runtime.advance(++token);};
  sample(a);a.start();sample(a);at(500);sample(a);stop(a);sample(a);const writes=a.writes;at(1500);sample(a);
  if(a.writes!==writes)throw Error('cancelled setter ran');
  b.start(1);sample(b);stop(b);at(2500);sample(b);
  b.start();sample(b);at(3000);sample(b);at(3500);sample(b);stop(b);stop(b);
  return {rows,checks:['single target evaluation','setter cancellation','delayed cancellation','completion','idempotent cancellation']};
 } finally {session.retire();runtime.dispose();}
}
