import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 await session.load('namespace-booleans',domain);
 const Flags=domain.getDefinition('nsflags.Flags'),rows=[],checks=[];
 const call=(owner,name)=>as3CallValue(get(owner,name),()=>[]);
 rows.push({id:'early',value:get(Flags,'early')});
 rows.push({id:'after',value:get(Flags,'after')});
 rows.push({id:'order',value:get(Flags,'log')});
 rows.push({id:'read',value:call(Flags,'read')});
 try{call(Flags,'write');rows.push({id:'write',value:'accepted'});}catch(error){rows.push({id:'write',value:[error.name,error.errorID,call(Flags,'read')]});}
 as3ConstructClass(Flags);rows.push({id:'construction',value:call(Flags,'read')});
 for(let i=0;i<3;i++){
  try{const value=call(domain.getDefinition('nsflags.Retry'),'read');rows.push({id:'retry:'+i,value:['value',value,get(domain.getDefinition('nsflags.RetryState'),'attempts')]});}
  catch(error){rows.push({id:'retry:'+i,value:['thrown',error,get(domain.getDefinition('nsflags.RetryState'),'attempts')]});}
 }
 rows.push({id:'retry-order',value:get(domain.getDefinition('nsflags.RetryState'),'log')});
 const check=(name,passed)=>checks.push({name,passed});
 const otherDomain=new ApplicationDomain(ApplicationDomain.currentDomain),otherSession=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 await otherSession.load('namespace-booleans',otherDomain);const Other=otherDomain.getDefinition('nsflags.Flags');
 check('source-identity-isolated',Other!==Flags);
 check('namespace-identities-distinct',call(Other,'read')[0]===true&&call(Other,'read')[1]===false);
 check('early-array-isolated',get(Other,'early')!==get(Flags,'early'));
 const namespaceKeys=Object.getOwnPropertySymbols(Flags).filter(key=>String(Symbol.keyFor(key)||'').includes('urn:op2:constant:'));
 check('namespace-constants-locked',namespaceKeys.length===5&&namespaceKeys.every(key=>{const d=Object.getOwnPropertyDescriptor(Flags,key);return d.writable===false&&d.configurable===false&&Reflect.set(Flags,key,false)===false;}));
 const before=get(Other,'log').length;otherDomain.getDefinition('nsflags.Flags');call(Other,'read');
 check('repeat-lookup-does-not-reinitialize',get(Other,'log').length===before);
 let firstFailure=false;try{call(otherDomain.getDefinition('nsflags.Retry'),'read');}catch(error){firstFailure=error==='retry';}
 check('retry-effects-isolated',firstFailure&&get(otherDomain.getDefinition('nsflags.RetryState'),'attempts')===1&&get(domain.getDefinition('nsflags.RetryState'),'attempts')===2);
 session.retire();check('retained-class-after-retirement',call(Flags,'read')[0]===true);otherSession.retire();
 return {rows,checks};
}
