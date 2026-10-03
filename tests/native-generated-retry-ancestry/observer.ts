import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
export async function run(module:NativeSourceClassModule) {
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:3});
 let checks=0;const check=(value:boolean)=>{if(!value)throw Error('Retry ancestry guard '+checks);checks++;};
 try{
  const domain=await session.load('subject',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Probe=domain.getDefinition('cases.Probe') as any,result=new Probe().snapshot();check(result.ready&&!result.failure);
  const other=await session.load('other',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Other=other.getDefinition('cases.Probe') as any;check(Other!==Probe);check(JSON.stringify(new Other().snapshot())===JSON.stringify(result));
  for(const name of ['Root','Middle','Leaf'])check(domain.getDefinition('cases.'+name)!==other.getDefinition('cases.'+name));
  const Leaf=domain.getDefinition('cases.Leaf') as any,Middle=domain.getDefinition('cases.Middle') as any,Root=domain.getDefinition('cases.Root') as any;
  check(Object.getPrototypeOf(Leaf.prototype)===Middle.prototype);check(Object.getPrototypeOf(Middle.prototype)===Root.prototype);
  return {rows:JSON.parse(JSON.stringify(result.observations)),checks};
 }finally{session.retire();}
}
