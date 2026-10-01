import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {IOErrorEvent,SecurityErrorEvent} from '@FLASH@/utils/AS3CanonicalErrorEventSubtypes';
import {Event} from '@FLASH@/events/Event';
import {ErrorEvent} from '@FLASH@/events/ErrorEvent';

// Host observations from the retained AIR probe; all construction uses compiled ErrorFactory.
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 const loaded=await session.load('error-event-construction',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Factory:any=loaded.getDefinition('model.ErrorFactory'),factory=new Factory();
 const rows:any[]=[];
 const record=(id:string,make:()=>any)=>{let value:any,failure='none';try{value=make();}catch(error){failure=error.name+':'+error.errorID;}
 rows.push({id,value:failure==='none'?[failure,value.type,value.bubbles,value.cancelable,value.text,value.errorID,value.eventPhase,value.target===null,value.currentTarget===null,value instanceof Event,value instanceof ErrorEvent,value instanceof IOErrorEvent,value instanceof SecurityErrorEvent]:[failure]});};
 for(const kind of ['io','security']){
  const create=(args:any[])=>factory[kind+args.length].apply(factory,args);
  record(kind+'-default',()=>create(['custom']));
  record(kind+'-four',()=>create(['custom',true,true,'detail']));
  record(kind+'-null',()=>create([null,null,null,null,null]));
  record(kind+'-undefined',()=>create([undefined,undefined,undefined,undefined,undefined]));
  record(kind+'-negative',()=>create(['custom',false,true,'',-7]));
  record(kind+'-overflow',()=>create([42,{},0,['a','b'],4294967295]));
  record(kind+'-fraction',()=>create(['custom','',1,false,3.9]));
  const effects:string[]=[];
  const type={toString(){effects.push('type');return 'coerced';}},text={toString(){effects.push('text');return 'converted';}},id={valueOf(){effects.push('id');return 9;}};
  record(kind+'-coercion',()=>create([type,true,false,text,id]));
  rows.push({id:kind+'-coercion-order',value:effects});
 }
 record('caught-string',()=>factory.caught('failure'));
 record('caught-null',()=>factory.caught(null));
 rows.push({id:'constants',value:factory.constants()});session.retire();return rows;
}
