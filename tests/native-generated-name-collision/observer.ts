import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3CallProperty as callProperty} from '@FLASH@/utils/AS3Property';
export async function run(module:any){
 const load=()=>createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1}).load('method-intrinsics',new ApplicationDomain(ApplicationDomain.currentDomain));
 const domain=await load(),Type=domain.getDefinition('methodintr.Subject'),Target=domain.getDefinition('methodintr.Target'),subject=as3ConstructClass(Type),target=as3ConstructClass(Target);
 const rows:any[]=[],call=(owner:any,name:string,...args:any[])=>callProperty(owner,name,()=>args);let result:any;
 for(const [id,args] of [['normal',['A','B','C']],['number',[2,3]],['null',null],['undefined',undefined],['empty',[]],['invalid',{}]]){
  for(const mode of ['own','foreign']){
   try{result=mode==='own'?call(Type,'own',args):call(Type,'foreign',{prefix:'ignored'},args);rows.push({id:id+'-'+mode,value:result});}
   catch(e:any){rows.push({id:id+'-'+mode,error:[e.name,e.errorID]});}
  }
 }
 rows.push({id:'call',value:call(Type,'callForeign',{prefix:'ignored'},'X','Y')});
 rows.push({id:'instance',value:call(Type,'instance',target,['X'])});
 rows.push({id:'explicit',value:call(subject,'explicit',['X'])});
 rows.push({id:'implicit',value:call(subject,'implicit',['X'])});
 try{call(Type,'instance',null,['X']);}catch(e:any){rows.push({id:'null-target',error:[e.name,e.errorID]});}
 const second=await load(),Other=second.getDefinition('methodintr.Subject');
 const domainChecks=[Other!==Type,call(Other,'own',['Z'])==='Z:'];if(domainChecks.some(v=>!v))throw Error('isolated methods');
 return {rows,domainChecks};
}
