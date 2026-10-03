import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
export async function run(module:NativeSourceClassModule) {
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:3});
 let checks=0;const check=(value:boolean)=>{if(!value)throw Error('Literal slot lifecycle '+checks);checks++;};
 try {
  const domain=await session.load('subject',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Probe=domain.getDefinition('LiteralSlotsProbe') as any,result=new Probe().snapshot();
  check(result.ready&&!result.failure);
  const Subject=domain.getDefinition('cases.LiteralSlots') as any;
  const sibling=await session.load('sibling',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Other=sibling.getDefinition('cases.LiteralSlots') as any;
  check(Subject!==Other);check(Subject.type()!==Other.type());check(Other.read()[0]==='');check(Other.read()[2]===true);
  const child=await session.load('child',new ApplicationDomain(domain.applicationDomain));
  check(child.getDefinition('cases.LiteralSlots')===Subject);check((child.getDefinition('cases.LiteralSlots') as any).type()===Subject.type());
  return {rows:result.observations,checks};
 }finally{session.retire();}
}
