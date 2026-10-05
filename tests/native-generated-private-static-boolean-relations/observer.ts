import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 await session.load('private-relations',domain);
 const Flags=domain.getDefinition('privateflags.Flags'),rows=[],checks=[];
 const call=(owner,name)=>as3CallValue(get(owner,name),()=>[]);
 rows.push({id:'early',value:get(Flags,'early')});
 rows.push({id:'after',value:get(Flags,'after')});
 rows.push({id:'order',value:get(Flags,'log')});
 rows.push({id:'read',value:call(Flags,'read')});
 rows.push({id:'changed',value:call(Flags,'change')});
 as3ConstructClass(Flags);rows.push({id:'construction',value:call(Flags,'read')});
 for(let i=0;i<3;i++){
  try{const value=call(domain.getDefinition('privateflags.Retry'),'read');rows.push({id:'retry:'+i,value:['value',value,get(domain.getDefinition('privateflags.RetryState'),'attempts')]});}
  catch(error){rows.push({id:'retry:'+i,value:['thrown',error,get(domain.getDefinition('privateflags.RetryState'),'attempts')]});}
 }
 rows.push({id:'retry-order',value:get(domain.getDefinition('privateflags.RetryState'),'log')});
 const check=(name,passed)=>checks.push({name,passed});
 const otherDomain=new ApplicationDomain(ApplicationDomain.currentDomain),otherSession=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 await otherSession.load('private-relations',otherDomain);const Other=otherDomain.getDefinition('privateflags.Flags');
 check('source-identity-isolated',Other!==Flags);
 check('fresh-private-state',call(Other,'read')[1]===true&&call(Flags,'read')[1]===false);
 check('early-array-isolated',get(Other,'early')!==get(Flags,'early'));
 const before=get(Other,'log').length;otherDomain.getDefinition('privateflags.Flags');call(Other,'read');
 check('repeat-lookup-does-not-reinitialize',get(Other,'log').length===before);
 let firstFailure=false;try{call(otherDomain.getDefinition('privateflags.Retry'),'read');}catch(error){firstFailure=error==='retry';}
 check('retry-effects-isolated',firstFailure&&get(otherDomain.getDefinition('privateflags.RetryState'),'attempts')===1&&get(domain.getDefinition('privateflags.RetryState'),'attempts')===2);
 session.retire();check('retained-class-after-retirement',call(Flags,'read')[1]===false);otherSession.retire();
 return {rows,checks};
}
