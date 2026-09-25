import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
export async function run(module){
 const load=async()=>{const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('jsonas',domain);return domain.getDefinition('jsonas.Parser');};
 const Parser=await load(),call=(name,args)=>as3CallValue(get(Parser,name),()=>args),rows=[];
 const attempt=(id,fn)=>{try{rows.push({id,value:fn()});}catch(e){rows.push({id,error:[e.name,e.errorID??0]});}};
 const values=['3','null','true','[]','{',null,undefined,3,true,{}];
 values.forEach((value,i)=>{attempt('parse-'+i,()=>call('parse',[value]));rows.push({id:'cast-'+i,value:call('cast',[value])});});
 let conversions=0;const disguised={toString(){conversions++;return '3';}};
 try{call('parse',[disguised]);}catch(e){rows.push({id:'no-conversion',value:[e.name,e.errorID,conversions]});}
 rows.push({id:'property',value:call('read',[{data:'7'}])});
 attempt('null-receiver',()=>call('read',[null]));
 let calls=0;const result=call('effect',[()=>{calls++;return '9';}]);rows.push({id:'once',value:[result,calls]});
 const other=await load();const domainChecks=[other!==Parser,as3CallValue(get(other,'parse'),()=>['4'])===4];
 if(domainChecks.some(v=>v!==true))throw new Error('Domain mismatch');return {rows,domainChecks};
}