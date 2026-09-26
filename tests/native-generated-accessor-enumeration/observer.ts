import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3Is} from '@FLASH@/utils/AS3Type';
export async function run(module:any){
 const load=()=>createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1}).load('accessor-enumeration',new ApplicationDomain(ApplicationDomain.currentDomain));
 const domain=await load(),Type=domain.getDefinition('accessorenum.Subject');
 const rows:any[]=[],subject=as3ConstructClass(Type);
 const describe=(keys:any)=>[keys.length,keys.indexOf('en_Eu')>=0,keys.indexOf('second')>=0];
 rows.push({id:'initial',value:describe(get(subject,'keys'))});
 for(const [id,input] of [['one',{en_Eu:'entry'}],['two',{en_Eu:'entry',second:'other'}],['empty',{}],['null',null]]){
  set(subject,'source',input);set(Type,'shared',input);
  rows.push({id:id+'-instance',value:[describe(get(subject,'keys')),get(subject,'visits')]});
  rows.push({id:id+'-static',value:describe(get(Type,'sharedKeys'))});
 }
 set(subject,'source',{en_Eu:'entry'});set(subject,'selected','before');
 rows.push({id:'setter-parameter',value:get(subject,'last')});
 set(subject,'source',{});set(subject,'selected','before');
 rows.push({id:'empty-retains',value:get(subject,'last')});
 const other=await load(),Other=other.getDefinition('accessorenum.Subject'),instance=as3ConstructClass(Other);
 const domainChecks=[Other!==Type,!as3Is(instance,Type)];if(domainChecks.some(v=>!v))throw Error('domain identity');
 return {rows,domainChecks};
}
