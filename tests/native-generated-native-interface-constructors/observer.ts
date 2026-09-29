import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {EventDispatcher} from '@FLASH@/utils/AS3CanonicalEventDispatcherConstruction';
import {Event} from '@FLASH@/events/Event';
import {ByteArray} from '@FLASH@/utils/AS3CanonicalByteArrayReference';
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const domain=await session.load('constructors',new ApplicationDomain(ApplicationDomain.currentDomain));
 const classes=['DispatcherSubject','RequiredHolder','InputHolder'].map(n=>domain.getDefinition('ctorcases.'+n) as any);
 const Subject=classes[0],rows:any[]=[];
 const fake={addEventListener(){},removeEventListener(){},dispatchEvent(){return true;},hasEventListener(){return false;},willTrigger(){return false;}};
 const samples=[null,undefined,new EventDispatcher(),new Subject(),new ByteArray(),{},fake,1,'text'];
 classes.forEach((Kind,c)=>{
  Kind.bodies=0;
  try{const empty=new Kind();rows.push({id:'default:'+c,value:[empty.saved===null,Kind.bodies]});}
  catch(e:any){rows.push({id:'default:'+c,value:[e.name,e.errorID,Kind.bodies]});}
  samples.forEach((value,i)=>{Kind.bodies=0;
   try{const item=new Kind(value);rows.push({id:c+':'+i,value:[item.saved===null,item.saved===value,Kind.bodies]});}
   catch(e:any){rows.push({id:c+':'+i,value:[e.name,e.errorID,Kind.bodies]});}
  });
 });
 const target=new EventDispatcher(),subject=new Subject(target);let calls=0;
 subject.addEventListener('test',(event:Event)=>{calls++;rows.push({id:'event-target',value:[event.target===target,event.currentTarget===target,event.target===subject,event.currentTarget===subject]});});
 rows.push({id:'dispatch',value:[subject.dispatchEvent(new Event('test')),calls,subject.saved===target]});
 let guards=0;
 for(const Kind of classes)for(const forged of [Object.create(EventDispatcher.prototype),Object.create(ByteArray.prototype)]){
  Kind.bodies=0;try{new Kind(forged);throw Error('Forged interface accepted');}catch(e:any){if(e.errorID!==1034)throw e;guards++;}
  if(Kind.bodies!==0)throw Error('Body entered before coercion');
 }
 session.retire();return {rows,guards};
}
