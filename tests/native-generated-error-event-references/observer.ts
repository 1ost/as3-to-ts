import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {IOErrorEvent,SecurityErrorEvent} from '@FLASH@/utils/AS3CanonicalErrorEventSubtypes';
import {Event} from '@FLASH@/events/Event';import {TextEvent} from '@FLASH@/events/TextEvent';import {ErrorEvent} from '@FLASH@/events/ErrorEvent';
class IOChild extends IOErrorEvent {constructor(){super('child',false,false,'child-io',-9);}}
class SecurityChild extends SecurityErrorEvent {constructor(){super('child',false,false,'child-security',-10);}}
const error=(action:()=>unknown)=>{try{action();return 'none';}catch(e){return e.name+':'+e.errorID;}};
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 const loaded=await session.load('error-event-references',new ApplicationDomain(ApplicationDomain.currentDomain));
 const TypeProbe:any=loaded.getDefinition('model.TypeProbe'),probe=new TypeProbe();
 const io=new IOErrorEvent('io',false,false,'disk',-7),security=new SecurityErrorEvent('security',false,false,'policy',-8);
 const cases:[string,unknown][]=[['io',io],['security',security],['error',new ErrorEvent('error',false,false,'generic')],
  ['event',new Event('plain')],['text',new TextEvent('text',false,false,'plain-text')],['null',null],['undefined',undefined],
  ['object',{}],['number',0],['boolean',false],['string','io'],['io-child',new IOChild()],['security-child',new SecurityChild()]];
 const rows=cases.map(([id,value])=>({id:'inspect-'+id,value:probe.inspect(value) as unknown}));
 rows.push({id:'describe-io',value:probe.describe(io)},{id:'describe-security',value:probe.describe(security)},
  {id:'describe-other',value:probe.describe(new Event('other'))},{id:'describe-null',value:probe.describe(null)},
  {id:'cast-io',value:probe.castIO(io)},{id:'cast-security',value:probe.castSecurity(security)},
  {id:'cast-io-wrong',value:error(()=>probe.castIO(security))},{id:'cast-security-wrong',value:error(()=>probe.castSecurity(io))},
  {id:'cast-io-null',value:error(()=>probe.castIO(null))},{id:'cast-security-undefined',value:error(()=>probe.castSecurity(undefined))});
 session.retire();return rows;
}