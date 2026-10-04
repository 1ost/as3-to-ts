import {EventDispatcher} from '@FLASH@/utils/AS3CanonicalEventDispatcherConstruction';
import {IEventDispatcher} from '@FLASH@/events/IEventDispatcher';
import {Event} from '@FLASH@/utils/AS3CanonicalEventConstruction';
import {as3Is} from '@FLASH@/utils/AS3Type';
import {NativeSourceClassModule,NativeLoadedSourceClasses,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
function observe(domain:NativeLoadedSourceClasses){const Probe=domain.getDefinition('cases.Probe') as any,result=new Probe().snapshot(),rows=result.observations,Root=domain.getDefinition('cases.Root') as any,Log=domain.getDefinition('cases.Log') as any;
   var oldLeaf:any=Log.instances[0],newLeaf:any=Log.instances[1],failedRoot:any=Log.roots[0],oldRoot:any=new failedRoot("native-old-root");
   rows.push({id:"native-membership",value:[as3Is(oldLeaf,EventDispatcher),as3Is(oldLeaf,IEventDispatcher),as3Is(newLeaf,EventDispatcher),as3Is(oldRoot,EventDispatcher),as3Is(oldRoot,Root)]});
   var calls:any[]=[];
   var listener:any=function(event:Event):void {calls.push([event.target===oldLeaf,event.currentTarget===oldLeaf]);event.preventDefault();};
   oldLeaf.addEventListener("ready",listener);
   rows.push({id:"native-leaf-isolation",value:[oldLeaf.hasEventListener("ready"),newLeaf.hasEventListener("ready"),oldRoot.hasEventListener("ready")]});
   rows.push({id:"native-leaf-dispatch",value:[oldLeaf.dispatchEvent(new Event("ready",false,true)),calls]});
   rows.push({id:"native-new-dispatch",value:[newLeaf.dispatchEvent(new Event("ready",false,true)),calls.length]});
   oldLeaf.removeEventListener("ready",listener);
   rows.push({id:"native-leaf-remove",value:[oldLeaf.hasEventListener("ready"),oldLeaf.dispatchEvent(new Event("ready",false,true)),calls.length]});
   var rootCalls:any[]=[];
   var rootListener:any=function(event:Event):void {rootCalls.push([event.target===oldRoot,event.currentTarget===oldRoot]);};
   oldRoot.addEventListener("ready",rootListener);
   rows.push({id:"native-root-isolation",value:[oldRoot.hasEventListener("ready"),oldLeaf.hasEventListener("ready"),newLeaf.hasEventListener("ready")]});
   rows.push({id:"native-root-dispatch",value:[oldRoot.dispatchEvent(new Event("ready")),rootCalls]});
   oldRoot.removeEventListener("ready",rootListener);
   rows.push({id:"native-root-remove",value:[oldRoot.hasEventListener("ready"),rootCalls.length,Log.roots.length,Log.leaves.length]});
return result;}
export async function run(module:NativeSourceClassModule) {
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:3});
 let checks=0;const check=(value:boolean)=>{if(!value)throw Error('Retry ancestry guard '+checks);checks++;};
 try{
  const domain=await session.load('subject',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Probe=domain.getDefinition('cases.Probe') as any,result=observe(domain);check(result.ready&&!result.failure);
  const other=await session.load('other',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Other=other.getDefinition('cases.Probe') as any;check(Other!==Probe);check(JSON.stringify(observe(other))===JSON.stringify(result));
  for(const name of ['Root','Middle','Leaf'])check(domain.getDefinition('cases.'+name)!==other.getDefinition('cases.'+name));
  const Leaf=domain.getDefinition('cases.Leaf') as any,Middle=domain.getDefinition('cases.Middle') as any,Root=domain.getDefinition('cases.Root') as any;
  check(Object.getPrototypeOf(Leaf.prototype)===Middle.prototype);check(Object.getPrototypeOf(Middle.prototype)===Root.prototype);
  const child=await session.load('child',new ApplicationDomain(domain.applicationDomain));
  for(const name of ['Root','Middle','Leaf'])check(child.getDefinition('cases.'+name)===domain.getDefinition('cases.'+name));
  return {rows:JSON.parse(JSON.stringify(result.observations)),checks};
 }finally{session.retire();}
}
