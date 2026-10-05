import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {as3SetProperty} from '@FLASH@/utils/AS3Property';
export async function run(module){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1}),domain=await session.load('private-constants',new ApplicationDomain(ApplicationDomain.currentDomain));
 const pick=n=>domain.getDefinition('intconstants.'+n) as any,Trace=pick('Trace'),Derived=pick('Derived'),Values=pick('Values'),rows=[];
 Trace.events=[];const first=new Derived(),second=new Derived();rows.push({id:'constructors',value:Trace.events.slice()});rows.push({id:'private-ownership',value:[first.compare(second),first.baseValue(),first.read()]});
 const values=new Values(),other=new Values();rows.push({id:'literals',value:values.read()});rows.push({id:'field-initializer',value:values.initialized});rows.push({id:'shadow',value:values.shadow()});rows.push({id:'other',value:values.other(other)});
 try{values.other(null);rows.push({id:'null',value:'accepted'});}catch(e){rows.push({id:'null',error:[e.name,e.errorID]});}
 Trace.events=[];rows.push({id:'receiver-effect',value:[values.effect(),Trace.events.slice()]});
 values.throwTarget=true;try{values.effect();rows.push({id:'receiver-throw',value:'accepted'});}catch(e){rows.push({id:'receiver-throw',value:[e.message,Trace.events.slice()]});}
 try{values.dynamicRead(null,'MAX');rows.push({id:'dynamic-null',value:'accepted'});}catch(e){rows.push({id:'dynamic-null',error:[e.name,e.errorID]});}
 rows.push({id:'dynamic-read',value:values.dynamicRead(values,'MAX')});
 try{values.dynamicWrite(values,'MAX');rows.push({id:'private-write',value:'accepted'});}catch(e){rows.push({id:'private-write',error:[e.name,e.errorID]});}
 for(const key of ['ZERO','MAX']){try{as3SetProperty(values,key,19);rows.push({id:'external-write:'+key,value:'accepted'});}catch(e){rows.push({id:'external-write:'+key,error:[e.name,e.errorID]});}}
 rows.push({id:'unchanged',value:values.read()});rows.push({id:'instance-array',value:[values.initialized===other.initialized,values.initialized===values.read()]});
 let hostGuards=0,hostFailures=0;for(const value of [Object.create(Values.prototype),new Proxy(values,{})]){try{values.other(value);hostFailures++;}catch(e){if(e.errorID===1034)hostGuards++;else hostFailures++;}}
 session.retire();return {rows,hostGuards,hostFailures};
}
