import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {ErrorEvent} from '@FLASH@/utils/AS3CanonicalErrorEventReference';
import {IOErrorEvent} from '@FLASH@/events/IOErrorEvent';
import {SecurityErrorEvent} from '@FLASH@/events/SecurityErrorEvent';
import {Event} from '@FLASH@/events/Event';
import {TextEvent} from '@FLASH@/events/TextEvent';
class ErrorChild extends ErrorEvent {constructor(){super('child');}}
class IOChild extends IOErrorEvent {constructor(){super('child');}}
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('error-event-tests',domain);
 const Reader=domain.getDefinition('typeops.Reader'),reader=as3ConstructClass(Reader),rows=[],checks=[];
 const invoke=(name,args)=>as3CallValue(get(reader,name),()=>args),reset=()=>set(reader,'effects',0),effects=()=>get(reader,'effects');
 let conversions=0;const event=new ErrorEvent('error'),fake={toString(){conversions++;return 'error';},valueOf(){conversions++;return event;}};
 const samples=[event,new IOErrorEvent('io'),new SecurityErrorEvent('security'),new ErrorChild(),new IOChild(),new Event('event'),new TextEvent('text'),null,undefined,{},fake,3,'text',true,ErrorEvent,ErrorEvent.prototype];
 for(let i=0;i<samples.length;i++){reset();rows.push({id:'inspect:'+i,value:invoke('inspect',[samples[i]])});}
 for(const name of ['andTest','orTest'])for(const flag of [false,true])for(const value of [event,fake]){
  reset();const result=invoke(name,[flag,value]);rows.push({id:name+':'+flag+':'+(value===event),value:[result,effects()]});
 }
 for(const flag of [false,true])for(const reversed of [false,true]){
  reset();const selected=invoke('choose',[flag,reversed?fake:event,reversed?event:fake]);rows.push({id:'choose:'+flag+':'+reversed,value:[selected===event,selected===null,effects()]});
 }
 const thrown={tag:'failure'};for(const name of ['throwAs','throwIs']){reset();try{invoke(name,[thrown]);rows.push({id:name,value:[false,effects()]});}catch(error){rows.push({id:name,value:[error===thrown,effects()]});}}
 rows.push({id:'conversions',value:conversions});
 const check=(name,ok)=>{checks.push({name,passed:ok});};
 for(const [name,value]of [['prototype-forgery',Object.create(ErrorEvent.prototype)],['proxy',new Proxy(event,{})],['copied-fields',{...event}],['class-object',ErrorEvent]] as [string,unknown][]){reset();const result=invoke('inspect',[value]);check(name,result[0]===false&&result[1]===false&&result[2]===true&&result[3]===2);}
 const otherDomain=new ApplicationDomain(ApplicationDomain.currentDomain),otherSession=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await otherSession.load('error-event-tests',otherDomain);
 const Other=otherDomain.getDefinition('typeops.Reader'),other=as3ConstructClass(Other);
 check('shared-native-distinct-source-domains',Other!==Reader&&as3CallValue(get(other,'inspect'),()=>[event])[0]===true);
 session.retire();reset();check('retained-native-after-retirement',invoke('inspect',[event])[0]===true);otherSession.retire();
 return {rows,checks};
}
