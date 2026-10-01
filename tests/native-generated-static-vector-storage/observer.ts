import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3VectorFromValues,as3VectorPrimitiveSpec} from '@FLASH@/utils/AS3Vector';
import {TabStop} from '@FLASH@/utils/AS3CanonicalTabStopReference';
export async function run(module){
 const load=async()=>{const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('vectors',domain);return domain;};
 const domain=await load(),Holder=domain.getDefinition('vectorcases.Holder'),Child=domain.getDefinition('vectorcases.Child');
 const first=as3ConstructClass(Holder,[]),second=as3ConstructClass(Holder,[]),child=as3ConstructClass(Child,[]),rows=[];
 const call=(o,n,args=[])=>as3CallValue(get(o,n),()=>args);
 const h=(n,args=[])=>call(Holder,n,args),ch=(n,args=[])=>call(child,n,args);
 rows.push({id:'defaults',value:[h('read')===null,h('readShared')===null,h('readTabs')===null,ch('readOwn')===null,ch('readInherited')===null]});
 const base=h('initialize');rows.push({id:'initialize',value:[base.length,base.fixed,base[0],base[1],base[2],call(first,'instanceRead')===base,call(second,'instanceRead')===base]});
 let inputs=[base,null,undefined,as3VectorFromValues(as3VectorPrimitiveSpec('uint'),[]),[],{},7];
 for(let i=0;i<inputs.length;i++){h('assign',[base]);try{const result=h('assign',[inputs[i]]);rows.push({id:'assign-'+i,value:['ok',result===inputs[i],h('read')===inputs[i],h('read')===null]});}catch(e){rows.push({id:'assign-'+i,value:[e.name,e.errorID,h('read')===base]});}}
 h('assign',[base]);rows.push({id:'coerce-write',value:[h('write',[2,4294967297]),base[2]]});
 try{h('write',[3,5]);}catch(e){rows.push({id:'bounds',value:[e.name,e.errorID,base.length]});}
 h('assignShared',[base]);rows.push({id:'inherited-read',value:[ch('readInherited')===base,ch('readOwn')===null]});
 const replacement=as3VectorFromValues(as3VectorPrimitiveSpec('int'),[23]);ch('assignInherited',[replacement]);rows.push({id:'inherited-write',value:[h('readShared')===replacement,ch('readInherited')===replacement,h('read')===base]});
 ch('assignOwn',[replacement]);rows.push({id:'private-owner',value:[ch('readOwn')===replacement,h('read')===base,call(first,'instanceRead')===base]});
 try{ch('assignInherited',[as3VectorFromValues(as3VectorPrimitiveSpec('uint'),[])]);}catch(e){rows.push({id:'inherited-type',value:[e.name,e.errorID,h('readShared')===replacement]});}
 const tabs=h('initializeTabs');rows.push({id:'tabs-default',value:[tabs.length,tabs.fixed,tabs[0]===null,tabs[1]===null]});
 const tab=new TabStop(),items=[tab,null,undefined,{},7];
 for(let i=0;i<items.length;i++){h('writeTab',[0,tab]);try{const result=h('writeTab',[0,items[i]]);rows.push({id:'tab-write-'+i,value:['ok',result===items[i],tabs[0]===items[i],tabs[0]===null]});}catch(e){rows.push({id:'tab-write-'+i,value:[e.name,e.errorID,tabs[0]===tab]});}}
 inputs=[tabs,null,undefined,as3VectorFromValues(as3VectorPrimitiveSpec('Object'),[]),base,[],{}];
 for(let i=0;i<inputs.length;i++){h('assignTabs',[tabs]);try{const result=h('assignTabs',[inputs[i]]);rows.push({id:'tab-assign-'+i,value:['ok',result===inputs[i],h('readTabs')===inputs[i],h('readTabs')===null]});}catch(e){rows.push({id:'tab-assign-'+i,value:[e.name,e.errorID,h('readTabs')===tabs]});}}
 const another=await load(),Other=another.getDefinition('vectorcases.Holder');
 const domainChecks=[Other!==Holder,call(Other,'read')===null,call(Other,'readShared')===null,call(Other,'readTabs')===null];
 call(Other,'assign',[replacement]);domainChecks.push(call(Other,'read')===replacement,h('read')===base);
 if(!domainChecks.every(Boolean))throw Error('static storage domain isolation');
 return {rows,domainChecks};
}
