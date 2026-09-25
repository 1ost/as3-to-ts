import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3GetProperty} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3Is} from '@FLASH@/utils/AS3Type';
export async function run(module:any){
 const load=()=>createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1}).load('qualified',new ApplicationDomain(ApplicationDomain.currentDomain));
 const domain=await load(),Type=domain.getDefinition('qualifiedread.Subject'),value=as3ConstructClass(Type);
 const call=(name:string,args:any[]=[])=>as3CallValue(as3GetProperty(value,name),()=>args);
 const rows=[{id:'sandbox',value:call('sameSandbox')},{id:'constants',value:call('constants')},
  {id:'repeated',value:call('repeated')},{id:'error-constant',value:call('errorConstant')},
  {id:'imported-collision',value:call('importedCollision',['local'])},{id:'parenthesized',value:call('parenthesized')}];
 const other=await load(),Other=other.getDefinition('qualifiedread.Subject'),instance=as3ConstructClass(Other);
 const domainChecks=[Other!==Type,!as3Is(instance,Type)];if(domainChecks.some(v=>!v))throw Error('domain identity');
 return {rows,domainChecks};
}
