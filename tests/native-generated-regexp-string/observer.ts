import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {isFlashRegExp} from '@FLASH@/utils/AS3CanonicalRegExpReference';
export async function run(module:NativeSourceClassModule) {
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:3});
 let checks=0;const check=(value:boolean)=>{if(!value)throw Error('RegExp String guard '+checks);checks++;};
 try {
  const domain=await session.load('subject',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Probe=domain.getDefinition('cases.Probe') as any,result=new Probe().snapshot();
  check(result.ready&&!result.failure);
  const other=await session.load('other',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Other=other.getDefinition('cases.Probe') as any;
  check(Other!==Probe);check(JSON.stringify(new Other().snapshot())===JSON.stringify(result));
  const P=domain.getDefinition('cases.Patterns') as any,Q=other.getDefinition('cases.Patterns') as any;
  check(P!==Q);check(P.pattern()!==Q.pattern());check(isFlashRegExp(P.pattern()));
  check(!(P.pattern() instanceof RegExp));
  return {rows:JSON.parse(JSON.stringify(result.observations)),checks};
 }finally{session.retire();}
}
