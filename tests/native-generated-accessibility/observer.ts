import {registerAS3GeneratedAccessibilityBase} from '@FLASH@/utils/AS3GeneratedClass';
import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {AccessibilityImplementation,prepareGeneratedAccessibilityImplementation as prepare,initializeGeneratedAccessibilityImplementation as initialize} from '@FLASH@/utils/AS3CanonicalAccessibilityConstruction';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3Is} from '@FLASH@/utils/AS3Type';
export async function run(module){
 const load=async domain=>{const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('accessibility',domain);return domain;};
 const domain=await load(new ApplicationDomain(ApplicationDomain.currentDomain)),Store=domain.getDefinition('accessibility.CustomAccessibility');
 const Probe=domain.getDefinition('AccessibilityConstructionProbe'),probe=as3ConstructClass(Probe,[]);
 const snapshot=as3CallValue(get(probe,'snapshot'),()=>[]);
 if(get(snapshot,'ready')!==true||get(snapshot,'failure')!=='')throw Error('snapshot failed');
 const rows=get(snapshot,'observations');
 const sibling=await load(new ApplicationDomain(ApplicationDomain.currentDomain)),Other=sibling.getDefinition('accessibility.CustomAccessibility'),other=as3ConstructClass(Other,[]);
 const domainChecks=[Other!==Store,as3Is(other,AccessibilityImplementation),!as3Is(other,Store),as3Is(other,Other)];
 if(domainChecks.some(v=>!v))throw Error('domain mismatch');
 let runtimeGuards=0;
 const check=(condition:boolean)=>{if(!condition)throw Error('accessibility guard failed');runtimeGuards++;};
 const rejects=(fn:()=>unknown,pattern:RegExp)=>{let failure;try{fn();}catch(e){failure=e;}check(pattern.test(String(failure)));};
 let traps=0;const hostProxy=new globalThis.Proxy(other,{get(){traps++;throw Error('host trap');},getPrototypeOf(){traps++;throw Error('host trap');}});
 for(const value of [{},Object.create(AccessibilityImplementation.prototype),new AccessibilityImplementation(),hostProxy]) {
  rejects(()=>prepare(value),/AS3_ACCESSIBILITY_CONSTRUCTION_UNSUPPORTED/);
  rejects(()=>initialize(value,[]),/AS3_ACCESSIBILITY_CONSTRUCTION_UNSUPPORTED/);
 }
 rejects(()=>prepare(other),/repeated preparation/);
 rejects(()=>initialize(other,[]),/repeated base entry/);
 check(traps===0);
 check(Object.getOwnPropertyDescriptor(AccessibilityImplementation.prototype,'stub').get.call(other)===get(other,'stub'));
 check(Object.getOwnPropertyDescriptor(AccessibilityImplementation.prototype,'errno').get.call(other)===get(other,'errno'));
 check(!Object.hasOwn(other,'stub')&&!Object.hasOwn(other,'errno'));
 let arity;try{as3ConstructClass(AccessibilityImplementation,[1]);}catch(e){arity=e;}
 check(arity?.errorID===1063);
 rejects(()=>registerAS3GeneratedAccessibilityBase(function Forged(){}),/canonical accessibility base/);
 return {rows,domainChecks,runtimeGuards};
}
