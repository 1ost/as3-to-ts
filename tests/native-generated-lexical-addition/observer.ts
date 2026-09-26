import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3GetProperty as get,as3SetProperty as set,as3CallProperty} from '@FLASH@/utils/AS3Property';
import {as3Is} from '@FLASH@/utils/AS3Type';
import {as3CreateObjectLiteral} from '@FLASH@/utils/AS3DynamicObject';
import {as3AddAssignLexicalProperty} from '@FLASH@/utils/AS3LexicalMembers';
import {QName} from '@FLASH@/utils/QName';
export async function run(module:any){
 const load=()=>createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1}).load('lexical-addition',new ApplicationDomain(ApplicationDomain.currentDomain));
 const domain=await load(),Type=domain.getDefinition('lexadd.Adder'),Slot=domain.getDefinition('lexadd.Slot');
 const adder=as3ConstructClass(Type),rows:any[]=[],marker={tag:'marker'};let log:any[]=[],value:any,result:any,slot:any,other:any,key:any,count:number;
 const object=(value:any)=>as3CreateObjectLiteral(Object.entries(value));
 const call=(method:string,...args:any[])=>as3CallProperty(adder,method,()=>args);
 const rhs=()=>{log.push('rhs');return 3.75;},fail=()=>{log.push('rhs');throw marker;};
 const error=(e:any)=>e===marker?['marker']:[e.name,e.errorID];
 for(const [id,input] of [['number',2],['string','a'],['null',null],['undefined',undefined]]){
  log=[];value=object({amount:input});result=call('add',value,'amount',rhs);
  rows.push({id,value:[String(result),String(value.amount),log]});
 }
 for(const kind of ['ok','read-fail','write-fail','rhs-fail']){
  log=[];slot=as3ConstructClass(Slot);set(slot,'log',log);
  if(kind==='read-fail')set(slot,'readFailure',marker);if(kind==='write-fail')set(slot,'writeFailure',marker);
  try{result=call('add',slot,'amount',kind==='rhs-fail'?fail:rhs);rows.push({id:kind,value:[result,get(slot,'stored'),log]});}
  catch(e){rows.push({id:kind,error:error(e),stored:get(slot,'stored'),log});}
 }
 for(const invalid of [null,undefined]){
  log=[];try{call('add',invalid,'amount',rhs);}catch(e){rows.push({id:invalid===null?'null-target':'undefined-target',error:error(e),log});}
 }
 log=[];value=object({amount:2});other=object({amount:100});result=call('replace',value,'amount',other,rhs);
 rows.push({id:'replace-target',value:[result,value.amount,other.amount,log]});
 log=[];value=object({amount:2,second:100});result=call('replaceKey',value,'amount','second',rhs);
 rows.push({id:'replace-key',value:[result,value.amount,value.second,log]});
 for(const kind of ['key-ok','key-first-fail','key-second-fail','key-change']){
  log=[];count=0;value=object({amount:2,second:100});
  key=object({toString:()=>{count++;log.push('key:'+count);if(count===1&&kind==='key-first-fail'||count===2&&kind==='key-second-fail')throw marker;return count===2&&kind==='key-change'?'second':'amount';}});
  try{result=call('add',value,key,rhs);rows.push({id:kind,value:[result,value.amount,value.second,log]});}
  catch(e){rows.push({id:kind,error:error(e),value:[value.amount,value.second,log]});}
 }
 for(const kind of ['convert-ok','convert-fail']){
  log=[];value=object({amount:object({valueOf:()=>{log.push('convert');if(kind==='convert-fail')throw marker;return 4;}})});
  try{result=call('add',value,'amount',rhs);rows.push({id:kind,value:[result,value.amount,log]});}
  catch(e){rows.push({id:kind,error:error(e),log});}
 }
 log=[];value=object({amount:2});result=call('computed',value,()=>{log.push('key-expression');return 'amount';},rhs);
 rows.push({id:'key-expression',value:[result,value.amount,log]});
 log=[];result=call('own','amount',rhs);rows.push({id:'private',value:[result,call('readOwn'),log]});
 log=[];result=call('add',adder,'amount',rhs);rows.push({id:'private-via-parameter',value:[result,call('readOwn'),log]});
 log=[];try{call('add',adder,new QName('','amount'),rhs);}catch(e){rows.push({id:'public-qname',error:error(e),log});}
 log=[];slot=as3ConstructClass(Slot);set(slot,'log',log);result=call('dot',slot,rhs);
 rows.push({id:'dot-public',value:[result,get(slot,'stored'),log]});
 log=[];result=call('dot',adder,rhs);rows.push({id:'dot-private',value:[result,call('readOwn'),log]});
 rows.push({id:'continuation',value:call('append','first','second')});
 const otherDomain=await load(),Other=otherDomain.getDefinition('lexadd.Adder'),instance=as3ConstructClass(Other);
 const domainChecks=[Other!==Type,!as3Is(instance,Type)];if(domainChecks.some(v=>!v))throw Error('domain identity');
 let authorityGuards=0;
 for(const forged of [null,{},Object.create(null)]){
  log=[];let rejected=false;
  try{as3AddAssignLexicalProperty(forged,object({amount:2}),'amount',rhs,()=>{log.push('write');return null;});}
  catch(e:any){rejected=e.message.includes('unknown lexical capability');}
  if(!rejected||log.length)throw Error('forged scope executed');authorityGuards++;
 }
 return {rows,domainChecks,authorityGuards};
}
