import {EventDispatcher} from '@FLASH@/utils/AS3CanonicalEventDispatcherConstruction';
import {Event as FlashEvent} from '@FLASH@/utils/AS3CanonicalEventConstruction';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3CallValue,getAS3FunctionIntrinsic} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3Is} from '@FLASH@/utils/AS3Type';
import {QName} from '@FLASH@/utils/QName';
export async function run(module:NativeSourceClassModule){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('namespace',domain);
 const base:any=as3ConstructClass(domain.getDefinition('cases.NamespaceBase')),child:any=as3ConstructClass(domain.getDefinition('cases.NamespaceChild')),opened:any=as3ConstructClass(domain.getDefinition('cases.NamespaceOpened'));
 const readKey=Symbol.for('as3.namespace.member@1:'+JSON.stringify(['urn:op2:dispatcher-namespaces','read']));const bound:any=child[readKey];
 const ns=(name:string)=>new QName('urn:op2:dispatcher-namespaces',name),call=(v:any,n:any,...args:any[])=>as3CallValue(get(v,n),()=>args),rows:any[]=[],row=(id:string,value:any)=>rows.push({id,value});
 row('native-base',[base,child,opened].map(v=>as3Is(v,EventDispatcher)));
 row('initial-fields',[get(base,ns('value')),get(child,ns('value')),get(opened,ns('value')),call(base,'countValue')]);
 row('namespace-dispatch',[call(base,ns('read'),1),call(child,ns('read'),2),call(opened,ns('read'),3)]);
 row('opened-inheritance',call(opened,'change'));
 row('field-isolation',[base,child,opened].map(v=>get(v,ns('value'))));
 set(child,ns('amount'),9);row('accessors',[get(child,ns('amount')),get(base,ns('amount')),call(child,ns('read'))]);
 row('bound-method',[bound===child[readKey],as3CallValue(getAS3FunctionIntrinsic(bound,'call'),()=>[base,6])]);
 row('namesake',[call(child,ns('hasEventListener'),'tick'),call(child,'hasEventListener','tick')]);
 const calls:any[]=[],listener=(e:any)=>{calls.push([e.target===child,e.currentTarget===child]);e.preventDefault();};
 call(child,'addEventListener','tick',listener);row('listener-added',[call(child,'countValue'),call(base,'countValue'),call(child,'hasEventListener','tick'),call(base,'hasEventListener','tick')]);
 row('native-dispatch',[call(child,'dispatchEvent',as3ConstructClass(FlashEvent,['tick',false,true])),calls]);
 call(child,'removeEventListener','tick',listener);row('listener-removed',[call(child,'countValue'),call(child,'hasEventListener','tick'),calls.length]);
 row('namespace-after-native',[call(child,ns('read')),call(child,ns('hasEventListener'),'tick')]);
 const deep:any=as3ConstructClass(domain.getDefinition('cases.Deep'));call(deep,'nativeAdd','tick',listener);row('indirect-native-base',call(deep,'hasEventListener','tick'));call(deep,'nativeRemove','tick',listener);row('indirect-remove',call(deep,'hasEventListener','tick'));
 call(base,'defaultAdd','default',listener);row('defaults-bypass-override',[call(base,'hasEventListener','default'),call(base,'countValue')]);call(base,'defaultRemove','default',listener);row('defaults-remove',call(base,'hasEventListener','default'));
 const order:any[]=[],typeObject={toString(){order.push('type');return 'coerced';}},priorityObject={valueOf(){order.push('priority');return 3.9;}};
 call(base,'rawAdd',typeObject,listener,0,priorityObject,0);row('coercion-order',[order,call(base,'hasEventListener','coerced')]);call(base,'rawRemove','coerced',listener,false);
 const priorityOrder:any[]=[],low=()=>priorityOrder.push('low'),high=()=>priorityOrder.push('high');call(base,'rawAdd','priority',low,false,3.1,false);call(base,'rawAdd','priority',high,false,3.9,false);call(base,'dispatchEvent',as3ConstructClass(FlashEvent,['priority']));row('int-priority',priorityOrder);
 call(base,'rawAdd','infinity',listener,false,Infinity,false);row('infinite-priority',call(base,'hasEventListener','infinity'));call(base,'rawRemove','infinity',listener,false);
 const failure={tag:'sentinel'};try{call(base,'rawAdd',{toString(){throw failure;}},listener,false,0,false);row('throw-identity',false);}catch(e){row('throw-identity',e===failure);}
 const errors=[null,undefined,{},()=>{}];errors.forEach((value,i)=>{try{call(base,'rawAdd','errors',value,false,0,false);row('listener-'+i,'accepted');}catch(e:any){row('listener-'+i,[e.name,e.errorID]);}});
 try{call(base,'rawAdd',null,listener,false,0,false);row('null-type','accepted');}catch(e:any){row('null-type',[e.name,e.errorID]);}
 try{call(base,'rawRemove','absent',{},false);row('remove-invalid','accepted');}catch(e:any){row('remove-invalid',[e.name,e.errorID]);}
 const finalOrder:any[]=[];try{call(base,'rawAdd',{toString(){finalOrder.push('type');return 'invalid';}},{},false,{valueOf(){finalOrder.push('priority');return 0;}},false);}catch(e:any){row('conversion-error-order',[finalOrder,e.name,e.errorID]);}
 session.retire();return rows;
}
