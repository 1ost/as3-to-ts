import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {Event} from '@FLASH@/utils/AS3CanonicalEventConstruction';
import {as3GetProperty} from '@FLASH@/utils/AS3Property';
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const loaded=await session.load('subject',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Reader=loaded.getDefinition('eventprops.Reader') as any,Subject=loaded.getDefinition('eventprops.Subject') as any;
 const reader=new Reader(),subject=new Subject(),event=new Event('probe'),rows:any[]=[],checks:string[]=[];
 const record=(id:string,fn:()=>unknown)=>{
  reader.calls=0;
  try{rows.push({id,value:fn(),calls:reader.calls});}
  catch(e:any){rows.push({id,error:[e.name,e.errorID],calls:reader.calls});}
 };
 record('null-event',()=>reader.targetCall(null));
 record('null-target',()=>reader.targetCall(event));
 record('null-current',()=>reader.currentCall(event));
 subject.addEventListener('probe',(e:Event)=>{
  record('target-call',()=>reader.targetCall(e));
  record('current-call',()=>reader.currentCall(e));
  record('read',()=>reader.read(e));
  record('write',()=>reader.write(e));
  record('indexed',()=>reader.indexed(e,'value'));
  record('missing-call',()=>reader.missingCall(e));
 });
 subject.dispatchEvent(event);
 record('after-target',()=>reader.targetCall(event));
 record('after-current',()=>reader.currentCall(event));
 let forgedRejected=false;try{as3GetProperty(Object.create(Event.prototype),"target");}catch(e){forgedRejected=true;}
 if(!forgedRejected)throw Error("forged Event property");checks.push("forged Event property rejected");
 const sibling=await session.load('sibling',new ApplicationDomain(ApplicationDomain.currentDomain));
 if(sibling.getDefinition('eventprops.Reader')===Reader)throw Error('sibling source identity');checks.push('sibling source identity');
 const retained=reader.targetCall;session.retire();if(retained(event)!=='received:argument')throw Error('retained callback');checks.push('retained callback');
 return {rows,checks};
}
