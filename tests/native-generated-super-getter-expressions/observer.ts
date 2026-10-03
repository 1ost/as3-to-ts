import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
export async function run(module:NativeSourceClassModule) {
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:3});
 let checks=0;const check=(value:boolean)=>{if(!value)throw Error('Super getter guard '+checks);checks++;};
 try {
  const domain=await session.load('subject',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Probe=domain.getDefinition('SuperGetterProbe') as any,result=new Probe().snapshot();
  check(result.ready&&!result.failure);
  const other=await session.load('other',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Other=other.getDefinition('SuperGetterProbe') as any;
  check(Other!==Probe);check(JSON.stringify(new Other().snapshot())===JSON.stringify(result));
  const Child=domain.getDefinition('cases.Child') as any,OtherChild=other.getDefinition('cases.Child') as any;
  check(Child!==OtherChild);check(!(new OtherChild(1) instanceof Child));
  return {rows:result.observations,checks};
 }finally{session.retire();}
}
