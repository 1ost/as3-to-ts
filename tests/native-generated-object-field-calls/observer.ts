import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
export async function run(module){
 const load=async()=>{const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('fieldcall',domain);return domain.getDefinition('fieldcall.Subject');};
 const Subject=await load(),call=(target,name,args)=>as3CallValue(get(target,name),()=>args),rows=[];
 const attempt=(id,fn)=>{try{rows.push({id,value:fn()});}catch(e){rows.push({id,error:[e.name,e.errorID??0]});}};
 let input:any={a:1};const subject=as3ConstructClass(Subject,[input]);
 attempt('static-own',()=>call(Subject,'has',[input,'a']));
 attempt('static-missing',()=>call(Subject,'has',[input,'b']));
 attempt('instance-own',()=>call(subject,'own',['a']));
 attempt('explicit-own',()=>call(subject,'explicit',['a']));
 attempt('shadow-local',()=>call(subject,'shadow',[{b:1},'a']));
 attempt('null',()=>call(Subject,'has',[null,'a']));
 attempt('write-normal',()=>call(Subject,'write',[as3ConstructClass(Object),'a',7]));
 for(const [id,key] of [['write-as3-has','hasOwnProperty'],['write-as3-enumerable','propertyIsEnumerable'],['write-as3-prototype','isPrototypeOf']])attempt(id,()=>call(Subject,'write',[as3ConstructClass(Object),key,7]));
 let log:any[]=[];input={m:function(value){log.push(this===input);return value;}};
 attempt('argument-before-lookup',()=>{const result=call(Subject,'invoke',[input,()=>{log.push('arg');input.m=function(v){log.push('new');log.push(this===input);return v;};return 9;}]);return [result,log];});
 log=[];attempt('null-after-argument',()=>{try{call(Subject,'invoke',[null,()=>{log.push('arg');return 1;}]);}catch(e){return [log,e.name,e.errorID??0];}return null;});
 const other=await load();const domainChecks=[other!==Subject,call(other,'has',[{b:2},'b'])===true,call(Subject,'has',[{a:1},'a'])===true];
 if(domainChecks.some(v=>v!==true))throw new Error('Domain mismatch');return {rows,domainChecks};
}