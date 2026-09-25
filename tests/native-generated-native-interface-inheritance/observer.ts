import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {EventDispatcher} from '@FLASH@/utils/AS3CanonicalEventDispatcherConstruction';
import {IEventDispatcher} from '@FLASH@/events/IEventDispatcher';
import {Event} from '@FLASH@/utils/AS3CanonicalEventConstruction';
import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3Is,as3As} from '@FLASH@/utils/AS3Type';
export async function run(module){
 const load=async domain=>{const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('contract',domain);return domain;};
 const domain=await load(new ApplicationDomain(ApplicationDomain.currentDomain)),def=n=>domain.getDefinition('nativecontract.'+n);
 const Parser=def('Parser'),Derived=def('Derived'),IParser=def('IParser'),IChild=def('IChild'),Consumer=def('Consumer');
 const parser=as3ConstructClass(Parser),child=as3ConstructClass(Derived),plain=new EventDispatcher();
 const call=(name,args)=>as3CallValue(get(Consumer,name),()=>args),rows=[],row=(id,value)=>rows.push({id,value});
 row('native-name',IEventDispatcher.name);
 row('identity',[as3Is(parser,IParser),as3Is(parser,IEventDispatcher),as3Is(parser,IChild),as3Is(child,IParser),as3Is(child,IChild),as3Is(child,IEventDispatcher)]);
 row('native-not-source',[as3Is(plain,IEventDispatcher),as3Is(plain,IParser),as3As(plain,IParser)===null]);
 const standalone=as3ConstructClass(def('Standalone'));
 row('standalone-identity',[as3Is(standalone,IParser),as3Is(standalone,IEventDispatcher),as3Is(standalone,IChild),call('key',[standalone])]);
 row('source-key',[call('key',[parser]),call('key',[child])]);
 row('empty-listeners',[call('has',[parser,'ready']),call('has',[child,'ready'])]);
 const calls=[],listener=e=>{calls.push([e.target===child,e.currentTarget===child]);e.preventDefault();};
 as3CallValue(get(child,'addEventListener'),()=>['ready',listener]);
 row('listener-isolation',[call('has',[parser,'ready']),call('has',[child,'ready'])]);
 row('dispatch',[call('send',[child,new Event('ready',false,true)]),calls]);
 as3CallValue(get(child,'removeEventListener'),()=>['ready',listener]);
 row('removal',[call('has',[child,'ready']),call('send',[child,new Event('ready')]),calls.length]);
 const fake={key:'parser',hasEventListener:s=>true};
 row('structural',[as3Is(fake,IParser),as3Is(fake,IEventDispatcher),as3As(fake,IParser)===null]);
 try{call('key',[as3As(fake,IParser)]);row('null-entry','accepted');}catch(e){row('null-entry',[get(e,'name'),get(e,'errorID')]);}
 const sibling=await load(new ApplicationDomain(ApplicationDomain.currentDomain)),inherited=await load(new ApplicationDomain(domain));
 const siblingInterface=sibling.getDefinition('nativecontract.IParser'),siblingClass=sibling.getDefinition('nativecontract.Parser'),siblingInstance=as3ConstructClass(siblingClass);
 const domainChecks=[siblingInterface!==IParser,siblingClass!==Parser,as3Is(siblingInstance,siblingInterface),!as3Is(siblingInstance,IParser),as3Is(siblingInstance,IEventDispatcher),inherited.getDefinition('nativecontract.IParser')===IParser,inherited.getDefinition('nativecontract.Parser')===Parser];
 if(domainChecks.some(value=>value!==true))throw new Error('Native interface domain mismatch');
 return {rows,domainChecks};
}
