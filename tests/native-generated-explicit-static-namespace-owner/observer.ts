import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {QName} from '@FLASH@/utils/QName';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
export async function run(module:NativeSourceClassModule){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain);
 await createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1}).load('namespace-owner',domain);
 const Child=domain.getDefinition('client.Child'),Base=domain.getDefinition('model.Base'),c=as3ConstructClass(Child,[]),rows:{id:string,value:unknown[]}[]=[];
 const call=(target:unknown,key:string,args:unknown[]=[])=>as3CallValue(get(target,key),()=>args,target);
 const key=new QName('urn:op2:inherited-static','count');
 const row=(id:string)=>rows.push({id,value:[call(Child,'read'),call(c,'instanceRead'),get(Base,key)]});
 row('initial');call(Child,'write',[7]);row('static-write');call(c,'instanceWrite',[9]);row('instance-write');call(Child,'writeAmount',[31]);row('accessor-write');set(Base,key,5);row('base-write');
 return rows;
}
