import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
export async function run(module){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1}),domain=await session.load('getter-construction',new ApplicationDomain(ApplicationDomain.currentDomain));
 const pick=n=>domain.getDefinition('gettercases.'+n) as any;
 const Trace=pick('Trace'),Config=pick('Config'),Consumer=pick('Consumer'),Alpha=pick('Alpha'),Beta=pick('Beta'),Broken=pick('Broken'),IFactory=pick('IFactory');
 const rows=[],config=new Config(),consumer=new Consumer(config),missing=new Consumer(null),values=[Alpha,Beta,Broken,null,undefined,{},function(){},IFactory];
 const error=e=>e===Trace.failure?['sentinel']:[e.name,e.errorID];
 for(let i=0;i<values.length;i++)for(let mode=0;mode<3;mode++){
  Trace.events=[];Trace.selected=values[i];Trace.failGetter=false;Trace.failReceiver=false;
  try{const result=consumer.make(mode);rows.push({id:'value:'+i+':'+mode,value:[result.kind,result.value],events:Trace.events.slice()});}catch(e){rows.push({id:'value:'+i+':'+mode,error:error(e),events:Trace.events.slice()});}
 }
 const subjects=[consumer,consumer,consumer,consumer,missing,missing,consumer,consumer],operations=['zero','extra','chained','chained','make','chained','parameter','parameter'];
 for(let i=0;i<operations.length;i++){
  Trace.events=[];Trace.selected=Alpha;Trace.failGetter=i===3;Trace.failReceiver=false;
  try{const result=operations[i]==='zero'?subjects[i].zero():operations[i]==='extra'?subjects[i].extra():operations[i]==='chained'?subjects[i].chained(0):operations[i]==='parameter'?consumer.parameter(i===7?null:config,0):subjects[i].make(0);rows.push({id:'path:'+i,value:[result.kind,result.value],events:Trace.events.slice()});}catch(e){rows.push({id:'path:'+i,error:error(e),events:Trace.events.slice()});}
 }
 Trace.events=[];Trace.selected=Alpha;Trace.failGetter=false;Trace.failReceiver=true;
 try{consumer.chained(0);rows.push({id:'receiver-throws',value:'accepted'});}catch(e){rows.push({id:'receiver-throws',error:error(e),events:Trace.events.slice()});}
 let hostGuards=0,hostFailures=0;const hostErrors=[];
 for(const value of [Object.create(Config.prototype),new Proxy(config,{})]){try{new Consumer(value);hostFailures++;}catch(e){hostErrors.push(String(e));if(e.errorID===1034)hostGuards++;else hostFailures++;}}
 Trace.failReceiver=false;Trace.failGetter=false;Trace.selected=new Proxy(Alpha,{});
 try{consumer.zero();hostFailures++;}catch(e){hostErrors.push(String(e));if(String(e)==='TypeError: AS3_CLASS_UNSUPPORTED: native class lacks exact source metadata')hostGuards++;else hostFailures++;}
 session.retire();return {rows,hostGuards,hostFailures,hostErrors};
}
