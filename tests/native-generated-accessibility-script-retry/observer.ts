import {AccessibilityImplementation} from '@FLASH@/utils/AS3CanonicalAccessibilityConstruction';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3CallValue,getAS3FunctionIntrinsic} from '@FLASH@/utils/AS3Invocation';
import {getQualifiedClassName} from '@FLASH@/utils/getQualifiedClassName';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3Is} from '@FLASH@/utils/AS3Type';
import {QName} from '@FLASH@/utils/QName';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('retry',domain);
 const Trace=domain.getDefinition('retryaccess.Trace'),array=n=>get(Trace,n),item=(n,i)=>get(array(n),i),count=()=>get(array('globals'),'length');
 const read=()=>as3CallValue(get(domain.getDefinition('retryaccess.Retry'),'read'),()=>[]);
 const callNull=fn=>as3CallValue(getAS3FunctionIntrinsic(fn,'call'),()=>[null]),rows=[],row=(id,value)=>rows.push({id,value});
 row('before',count());
 try{read();row('first','accepted');}catch(e){if(e!==get(Trace,'failure'))throw e;row('first',[e===get(Trace,'failure'),count(),get(array('arrays'),'length')]);}
 const firstFunction=item('functions',0);row('failed-closure',[callNull(firstFunction)===item('globals',0),getQualifiedClassName(callNull(firstFunction))]);
 const failedClass=item('classes',0),failedInstance=as3ConstructClass(failedClass),invoke=(object,name,args=[])=>as3CallValue(get(object,name),()=>args);
 row('failed-instance',[as3Is(failedInstance,AccessibilityImplementation),get(failedInstance,'defaults'),get(failedInstance,'stub'),get(failedInstance,'errno'),invoke(failedInstance,'get_accName',[3])]);
 set(failedInstance,'stub',false);set(failedInstance,'errno',29);
 set(item('globals',0),'marker',19);
 try{read();row('second','accepted');}catch(e){row('second',[e===get(Trace,'failure'),count(),get(array('arrays'),'length')]);}
 row('retry-identities',['globals','classes','functions','arrays'].map(n=>item(n,0)===item(n,1)));
 row('retry-global-state',[get(item('globals',0),'marker'),get(item('globals',1),'marker')]);
 set(Trace,'fail',false);const state=read();row('success',[count(),get(state,0)===item('arrays',2),get(state,0)!==get(state,1),get(get(state,0),'length'),get(get(state,1),'length')]);
 const selected=domain.getDefinition('retryaccess.Retry');
 row('success-identities',[item('globals',0)===item('globals',2),item('classes',0)===selected,item('classes',2)===selected,item('arrays',0)===get(state,0),callNull(firstFunction)===item('globals',2)]);
 row('success-global-state',[get(callNull(item('functions',2)),'marker'),get(item('globals',0),'marker')]);
 const again=read();row('success-once',[count(),get(again,0)===get(state,0),get(again,1)===get(state,1)]);
 const binding=(global,expected)=>{try{const value=get(global,new QName('retryaccess','Retry'));return ['value',value===expected,value===null,value===undefined];}catch(e){return ['error',e===get(Trace,'failure'),String(e)];}};
 row('failed-global-binding',binding(item('globals',0),item('classes',0)));row('successful-global-binding',binding(item('globals',2),selected));row('after-binding-reads',count());
 const instance=as3ConstructClass(selected);
 row('successful-instance',[as3Is(instance,AccessibilityImplementation),as3Is(instance,selected),as3Is(failedInstance,selected),get(instance,'defaults'),get(instance,'stub'),get(instance,'errno')]);
 row('native-state-isolation',[get(failedInstance,'stub'),get(failedInstance,'errno'),get(instance,'stub'),get(instance,'errno')]);
 row('callbacks',[invoke(failedInstance,'get_accName',[5]),invoke(instance,'get_accName',[8]),invoke(failedInstance,'get_accFocus'),invoke(instance,'getChildIDArray')]);
 const bound=get(failedInstance,'get_accName');row('bound-override',[bound===get(failedInstance,'get_accName'),as3CallValue(getAS3FunctionIntrinsic(bound,'call'),()=>[instance,12])]);
 try{invoke(failedInstance,'get_accRole',[0]);row('native-error','accepted');}catch(e){row('native-error',[get(e,'name'),get(e,'errorID')]);}
 row('parent-identity',[as3Is(failedInstance,AccessibilityImplementation),item('classes',0)===failedClass,AccessibilityImplementation===AccessibilityImplementation,count()]);
 const sibling=new ApplicationDomain(ApplicationDomain.currentDomain),siblingSession=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await siblingSession.load('sibling',sibling);
 const otherTrace=sibling.getDefinition('retryaccess.Trace');
 const child=new ApplicationDomain(domain),childSession=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await childSession.load('child',child);
 set(otherTrace,'fail',false);const otherClass=sibling.getDefinition('retryaccess.Retry'),otherInstance=as3ConstructClass(otherClass);
 const domainChecks=[otherTrace!==Trace,get(otherTrace,'globals')!==array('globals'),get(get(otherTrace,'globals'),'length')===1,child.getDefinition('retryaccess.Trace')===Trace,child.getDefinition('retryaccess.Retry')===selected,
 otherClass!==selected,otherInstance!==instance,as3Is(otherInstance,AccessibilityImplementation),get(otherInstance,'stub')===true,get(otherInstance,'errno')===7];
 if(domainChecks.some(value=>value!==true))throw new Error('Class script domain isolation/inheritance mismatch');
 return {rows,domainChecks};
}
