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
 call(child,'trackedAdd','tick',listener);row('listener-added',[call(child,'countValue'),call(base,'countValue'),call(child,'hasEventListener','tick'),call(base,'hasEventListener','tick')]);
 row('native-dispatch',[call(child,'dispatchEvent',as3ConstructClass(FlashEvent,['tick',false,true])),calls]);
 call(child,'trackedRemove','tick',listener);row('listener-removed',[call(child,'countValue'),call(child,'hasEventListener','tick'),calls.length]);
 row('namespace-after-native',[call(child,ns('read')),call(child,ns('hasEventListener'),'tick')]);
 session.retire();return rows;
}
