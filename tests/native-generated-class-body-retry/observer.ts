import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3Is} from '@FLASH@/utils/AS3Type';
import {QName} from '@FLASH@/utils/QName';
export async function run(module:NativeSourceClassModule){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('body',domain);
 const Trace=domain.getDefinition('bodycases.Trace'),body=():any=>domain.getDefinition('bodycases.Body'),arr=(name:string):any=>get(Trace,name),item=(name:string,i:number):any=>get(arr(name),i),len=(name:string)=>get(arr(name),'length') as number,rows:any[]=[],row=(id:string,value:any)=>rows.push({id,value}),token=new QName('urn:op2:class-body-retry','token');
 const invoke=(object:any,name:any,...args:any[])=>as3CallValue(get(object,name),()=>args),call=(fn:any,...args:any[])=>as3CallValue(fn,()=>args),snapshot=()=>Array.from({length:len('log')},(_,i)=>item('log',i));
 row('before',len('log'));try{body();row('first','accepted');}catch(e){row('first',[e===get(Trace,'failure'),len('classes')]);}
 row('first-order',snapshot());const failed=item('classes',0),callback=item('callbacks',0),failedValue=item('values',0),instance:any=as3ConstructClass(failed);
 row('failed-body-state',[get(get(failed,token),'tag'),get(failed,'after')===failedValue,get(invoke(instance,'read'),'tag'),get(arr('holder'),'converter')===callback,call(callback,failedValue)===failedValue]);
 try{body();row('second','accepted');}catch(e){row('second',[e===get(Trace,'failure'),len('classes')]);}row('retry-order',snapshot());
 row('retry-identities',[item('classes',0)===item('classes',1),item('callbacks',0)===item('callbacks',1),item('values',0)===item('values',1),get(failed,token)===get(item('classes',1),token)]);
 set(Trace,'fail',false);const selected=body();row('success-order',snapshot());row('success-identities',[len('classes'),item('classes',2)===selected,item('classes',0)===selected,get(arr('holder'),'converter')===item('callbacks',2),get(selected,'after')===item('values',2)]);
 row('retained-failed-state',[get(failed,'after')===failedValue,call(callback,failedValue)===failedValue,get(invoke(instance,'read'),'tag'),as3Is(instance,selected)]);
 const good:any=as3ConstructClass(selected);row('successful-instance',[as3Is(good,domain.getDefinition('bodycases.Base') as any),as3Is(good,selected),get(invoke(good,'read'),'tag'),invoke(good,'read')===invoke(instance,'read')]);
 row('success-once',[body()===selected,len('classes'),len('log')]);try{set(selected,token,{});row('readonly-token','accepted');}catch(e:any){row('readonly-token',[e.name,e.errorID]);}
 session.retire();return rows;
}
