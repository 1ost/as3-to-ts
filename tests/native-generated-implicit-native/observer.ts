import '@ENGINE@/tests/nativeCanonicalSpriteClass/init-imports';
import {Laya} from '@ENGINE@/src/layaAir/Laya';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {Event} from '@FLASH@/events/Event';
import {IEventDispatcher} from '@FLASH@/events/IEventDispatcher';
import {as3Is} from '@FLASH@/utils/AS3Type';
export async function run(module:NativeSourceClassModule){
 await Laya.init(320,240);
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const domain=await session.load('implicit',new ApplicationDomain(ApplicationDomain.currentDomain));
 const get=(n:string)=>domain.getDefinition('implicitnative.'+n) as any;
 const Trace=get('Trace'),classes=['EmptyDispatcher','BodyDispatcher','EmptySprite','BodySprite','ChildDispatcher'].map(get),rows:any[]=[];
 for(let c=0;c<classes.length;c++){
  const Kind=classes[c];Trace.rows=[];const value=new Kind();
  rows.push({id:'default:'+c,value:[value.stamp,as3Is(value,IEventDispatcher),Trace.rows.concat()]});
  if(c===1)rows.push({id:'body',value:[value.value,value.seen]});
  if(c===2||c===3)rows.push({id:'position:'+c,value:[value.x,value.y,value.numChildren]});
  if(c===4)rows.push({id:'child',value:[value.childStamp]});
  Trace.rows=[];
  try{new Kind(19,20);rows.push({id:'arity:'+c,value:'accepted'});}
  catch(e:any){rows.push({id:'arity:'+c,value:[e.name,e.errorID,Trace.rows.concat()]});}
 }
 let Kind=classes[1];Trace.rows=[];let value=new Kind(undefined);rows.push({id:'undefined-dispatcher',value:[value.value,value.seen,Trace.rows.concat()]});
 Trace.rows=[];value=new Kind(19);rows.push({id:'explicit-dispatcher',value:[value.value,value.seen,Trace.rows.concat()]});
 Trace.rows=[];try{new Kind(-1);}catch(e:any){rows.push({id:'failed-body',value:[e.name,e.message,Trace.rows.concat()]});}
 Kind=classes[3];Trace.rows=[];value=new Kind(undefined);rows.push({id:'undefined-sprite',value:[value.x,value.y,Trace.rows.concat()]});
 const a=new classes[0](),b=new classes[0]();a.items.push(1);let calls=0,correct=false;
 a.addEventListener('ready',(event:Event)=>{calls++;correct=event.target===a&&event.currentTarget===a;});
 rows.push({id:'empty-dispatch',value:[a.dispatchEvent(new Event('ready')),calls,correct,b.hasEventListener('ready'),a.items.length,b.items.length]});
 session.retire();return {rows};
}
