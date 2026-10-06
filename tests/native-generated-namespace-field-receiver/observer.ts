import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {QName} from '@FLASH@/utils/QName';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
export async function run(module:NativeSourceClassModule){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain);
 await createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1}).load('namespace-field',domain);
 const Child=domain.getDefinition('client.Child'),Base=domain.getDefinition('model.Base'),Decoy=domain.getDefinition('decoy.Composer'),c=as3ConstructClass(Child,[]),rows:{id:string,value:unknown}[]=[];
 const call=(target:unknown,key:unknown,args:unknown[]=[])=>as3CallValue(get(target,key),()=>args,target);
 rows.push({id:'static-first',value:call(Child,'swap',[['one']])});rows.push({id:'static-next',value:call(Child,'swap',[['two']])});
 rows.push({id:'instance-first',value:call(c,'instanceSwap',[['instance']])});rows.push({id:'instance-next',value:call(c,'instanceSwap',[['next']])});
 rows.push({id:'local-shadow',value:call(Child,'local',[as3ConstructClass(Decoy,[])])});
 const factory=get(Base,new QName('urn:op2:field-detail','factory'));
 rows.push({id:'explicit-base',value:call(factory,new QName('urn:op2:field-detail','swapLines'),[['base']])});
 rows.push({id:'static-after-base',value:call(Child,'swap',[['last']])});return rows;
}
