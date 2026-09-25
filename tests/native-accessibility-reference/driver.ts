import {AccessibilityImplementation as Implementation, AccessibilityImplementationDeclaration as token} from 'ENGINE/src/layaAir/flash/utils/AS3CanonicalAccessibilityReference';
import {nativeSourceClassModule} from './module.js';
import {createNativeSourceClassLoadingSession} from 'ENGINE/src/layaAir/flash/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from 'ENGINE/src/layaAir/flash/system/ApplicationDomain';
import {as3SetProperty} from 'ENGINE/src/layaAir/flash/utils/AS3Property';
import {as3Is,as3As,as3CoerceReference} from 'ENGINE/src/layaAir/flash/utils/AS3Type';
import {getAS3DeclarationType,getAS3SourceBase} from 'ENGINE/src/layaAir/flash/utils/AS3DeclarationType';
import {describeRegisteredFlashType} from 'ENGINE/src/layaAir/flash/utils/FlashTypeMetadata';
import {declareAS3ReferenceType} from 'ENGINE/src/layaAir/flash/utils/AS3GeneratedClass';

(globalThis as any).done=(async()=>{
 const session=createNativeSourceClassLoadingSession({resolve:()=>nativeSourceClassModule,maxModules:1});
 const domain=await session.load('holder',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Holder:any=domain.getDefinition('AccessibilityHolder');
 const first=new Implementation(),second=new Implementation(),rows:any[]=[];
 let holder=new Holder();
 rows.push({id:'default',value:[holder.value===null,holder.view===null]});
 holder=new Holder(first);
 rows.push({id:'initial',value:[holder.value===first,holder.view===first]});
 const values=[first,second,null,undefined,{},[],1,'x',Implementation];
 const error=(e:any)=>[e.name,e.errorID];
 values.forEach((input,index)=>{
  rows.push({id:'inspect-'+index,value:holder.inspect(input)});
  holder.value=first;let failure=null,result:unknown=undefined;
  try{result=holder.accept(input);}catch(e){failure=error(e);}
  rows.push({id:'accept-'+index,error:failure,value:[holder.value===first,holder.value===input,holder.value===null,result===input,result===undefined]});
  holder.value=first;failure=null;
  try{as3SetProperty(holder,'value',input);}catch(e){failure=error(e);}
  rows.push({id:'field-'+index,error:failure,value:[holder.value===first,holder.value===input,holder.value===null]});
 });
 const calls:string[]=[],hooks={valueOf(){calls.push('value');return first;},toString(){calls.push('string');return 'implementation';}};
 let failure=null;holder.value=first;
 try{holder.accept(hooks);}catch(e){failure=error(e);}
 rows.push({id:'hooks',error:failure,value:[holder.value===first,calls]});
 failure=null;try{as3SetProperty(holder,'view',second);}catch(e){failure=error(e);}
 rows.push({id:'readonly',error:failure,value:[holder.view===first]});
 let guards=0;const check=(ok:boolean,label:string)=>{if(!ok)throw Error(label);guards++;};
 check(Object.isFrozen(token)&&getAS3DeclarationType(Implementation)===token,'exact canonical token');
 check(getAS3SourceBase(Implementation)===null,'Object source base');
 check(describeRegisteredFlashType(Implementation)==null,'reference binding must not invent reflection');
 check(values.every(value=>as3Is(value,token)===as3Is(value,Implementation)),'constructor/token agreement');
 const sameName=declareAS3ReferenceType(token.name);
 check(!as3Is(first,sameName.type),'name alone is not authority');
 let traps=0;const proxy=new Proxy(first,{get(){traps++;throw Error('get trap');},getPrototypeOf(){traps++;throw Error('prototype trap');}});
 const revoked=Proxy.revocable(first,{});revoked.revoke();
 for(const bad of [Object.create(Implementation.prototype),proxy,revoked.proxy]){
  let rejected=false;holder.value=first;try{holder.accept(bad);}catch(e){rejected=(e as any).errorID===1034;}
  check(rejected&&holder.value===first&&!as3Is(bad,token)&&as3As(bad,token)===null,'reject forged receiver without mutation');
 }
 check(traps===0,'nominal checks avoid proxy traps');
 class Child extends Implementation {override get_accName(id:number){return 'child-'+id;}}
 const child=new Child();
 check(holder.accept(child)===child&&holder.view.get_accName(7)==='child-7','genuine native subclass remains accepted');
 let exactHeld=false;try{describeRegisteredFlashType(child);}catch{exactHeld=true;}
 // A native subclass cannot acquire its parent's exact source Class authority.
 check(exactHeld||describeRegisteredFlashType(child)==null,'no inherited leaf reflection');
 session.retire();
 check(holder.accept(second)===second&&as3CoerceReference(second,token)===second,'retained instance after retirement');
 (globalThis as any).result={rows,guards};
})();
