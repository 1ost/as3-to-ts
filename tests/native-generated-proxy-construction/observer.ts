import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {Proxy, ProxyConstructorEntry, prepareGeneratedFlashProxy, initializeGeneratedFlashProxy} from '@FLASH@/utils/AS3CanonicalProxyConstruction';
import {isCanonicalFlashProxy} from '@FLASH@/utils/Proxy';
import {as3GetProperty as get, as3SetProperty as set, as3HasProperty as has, as3DeleteProperty as del} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3Is} from '@FLASH@/utils/AS3Type';
import {getRegisteredFlashReflectionAuthority} from '@FLASH@/utils/FlashTypeMetadata';
export async function run(module){
 const load=async domain=>{const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('proxy',domain);return domain;};
 const domain=await load(new ApplicationDomain(ApplicationDomain.currentDomain)),def=n=>domain.getDefinition('proxyconstruct.'+n);
 const Entry=def('Entry'),Child=def('Child'),Consumer=def('Consumer');
 const entry=as3ConstructClass(Entry,[]),child=as3ConstructClass(Child,[]),rows=[],row=(id,value)=>rows.push({id,value});
 const call=(name,args)=>as3CallValue(get(Consumer,name),()=>args);
 row('entry-before',get(entry,'before'));row('entry-after',get(entry,'after'));
 row('child-before',get(child,'before'));row('child-after',get(child,'after'));
 row('identity',[as3Is(entry,Proxy),as3Is(child,Proxy),as3Is(child,Entry),as3Is(child,Child),as3Is(entry,Child),call('accept',[child])===child]);
 set(entry,'value',21);
 row('declared-access',[as3CallValue(get(entry,'inspect'),()=>[]),as3CallValue(get(child,'inspect'),()=>[]),has('value',entry),del(entry,'value')]);
 const method=get(entry,'inspect');row('method-closure',as3CallValue(method,()=>[]));
 row('null',[call('accept',[null])===null,call('accept',[undefined])===null]);
 try{call('accept',[{}]);row('wrong','accepted');}catch(e){row('wrong',[get(e,'name'),get(e,'errorID')]);}
 try{Reflect.construct(Proxy,[1]);row('extra-arguments','accepted');}catch(e){row('extra-arguments',[get(e,'name'),get(e,'errorID')]);}
 const sibling=await load(new ApplicationDomain(ApplicationDomain.currentDomain)),siblingEntry=sibling.getDefinition('proxyconstruct.Entry');
 const other=as3ConstructClass(siblingEntry,[]);
 const domainChecks=[siblingEntry!==Entry,as3Is(other,Proxy),!as3Is(other,Entry),as3Is(other,siblingEntry)];
 if(domainChecks.some(v=>!v))throw Error('Proxy domain mismatch');
 const guards=[],guard=(id,value)=>{if(!value)throw Error(id);guards.push(id);};
 const rejects=(id,fn)=>{let rejected=false;try{fn();}catch(e){rejected=/AS3_PROXY_CONSTRUCTION_UNSUPPORTED/.test(String(e));}guard(id,rejected);};
 guard('frozen-entry',Object.isFrozen(ProxyConstructorEntry)&&ProxyConstructorEntry.constructor===Proxy);
 guard('genuine-native',isCanonicalFlashProxy(new Proxy()));
 guard('genuine-generated',isCanonicalFlashProxy(entry)&&isCanonicalFlashProxy(child));
 const fake=Object.create(Entry.prototype);
 guard('unentered-lookalike',!isCanonicalFlashProxy(fake)&&!as3Is(fake,Proxy));
 rejects('lookalike-prepare',()=>prepareGeneratedFlashProxy(fake));
 rejects('native-is-not-generated',()=>prepareGeneratedFlashProxy(new Proxy()));
 rejects('repeat-prepare',()=>prepareGeneratedFlashProxy(entry));
 rejects('repeat-super',()=>initializeGeneratedFlashProxy(entry,[]));
 const document=value=>{const authority=getRegisteredFlashReflectionAuthority(value);if(authority?.kind!=='source-complete')throw Error('Proxy reflection missing');return authority.document;};
 return {rows,domainChecks,guards,reflection:{classDocument:document(Proxy),instanceDocument:document(new Proxy())}};
}
