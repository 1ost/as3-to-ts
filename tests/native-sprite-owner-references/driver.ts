import 'ENGINE/tests/nativeDisplayProjection/entry';
import {isFlashContextMenu} from 'ENGINE/src/layaAir/flash/ui/ContextMenu';
import {Loader} from 'ENGINE/src/layaAir/flash/display/Loader';
import {EventDispatcherDeclaration} from 'ENGINE/src/layaAir/flash/utils/AS3CanonicalDisplayTypes';
import {LoaderInfo,LoaderInfoDeclaration,ContextMenu} from 'ENGINE/src/layaAir/flash/utils/AS3CanonicalSpriteOwnerReferences';
import {nativeSourceClassModule} from './module.js';
import {createNativeSourceClassLoadingSession} from 'ENGINE/src/layaAir/flash/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from 'ENGINE/src/layaAir/flash/system/ApplicationDomain';
import {as3SetProperty} from 'ENGINE/src/layaAir/flash/utils/AS3Property';
import {isCanonicalAS3ReferenceImplementation,registerCanonicalAS3ReferenceImplementation,as3Is,as3As,as3CoerceReference} from 'ENGINE/src/layaAir/flash/utils/AS3Type';
import {getAS3DeclarationType,getAS3SourceBase} from 'ENGINE/src/layaAir/flash/utils/AS3DeclarationType';
import {describeRegisteredFlashType} from 'ENGINE/src/layaAir/flash/utils/FlashTypeMetadata';
import {declareAS3ReferenceType} from 'ENGINE/src/layaAir/flash/utils/AS3GeneratedClass';

(globalThis as any).done=(async()=>{
 const session=createNativeSourceClassLoadingSession({resolve:()=>nativeSourceClassModule,maxModules:1});
 const domain=await session.load('holder',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Holder:any=domain.getDefinition('SpriteOwnerHolder');
 const rows:any[]=[],specs:any[]=[
 ['LoaderInfo',LoaderInfo,LoaderInfoDeclaration,new Loader().contentLoaderInfo,new Loader().contentLoaderInfo],
 ['ContextMenu',ContextMenu,ContextMenu,new ContextMenu(),new ContextMenu()]];
 let guards=0;const check=(ok:boolean,label:string)=>{if(!ok)throw Error(label);guards++;};
 check(isCanonicalAS3ReferenceImplementation(ContextMenu,'flash.ui::ContextMenu'),'exact named proof');
 check(!isCanonicalAS3ReferenceImplementation(ContextMenu,'ContextMenu'),'wrong qualified name rejected');
 check(!isCanonicalAS3ReferenceImplementation(class ContextMenu {},'flash.ui::ContextMenu'),'same name constructor rejected');
 for(const [proof,name] of [[()=>true,'flash.ui::ContextMenu'],[isFlashContextMenu,'wrong'],[isFlashContextMenu,''] ] as const){
  let rejected=false;try{registerCanonicalAS3ReferenceImplementation(ContextMenu,proof,name);}catch(e){rejected=true;}
  check(rejected&&isCanonicalAS3ReferenceImplementation(ContextMenu,'flash.ui::ContextMenu'),'registration conflict is atomic');
 }
 for(const [label,Implementation,token,first,second] of specs){
 if(label==='LoaderInfo')rows.push({id:label+'-base',value:getAS3SourceBase(Implementation)?.name});
 let holder=new Holder();
 rows.push({id:label+'-'+'default',value:[holder['value'+label]===null,holder['view'+label]===null]});
 holder=new Holder(label==='LoaderInfo'?first:null,label==='ContextMenu'?first:null);
 rows.push({id:label+'-'+'initial',value:[holder['value'+label]===first,holder['view'+label]===first]});
 const values=[first,second,null,undefined,{},[],1,'x',Implementation];
 const error=(e:any)=>[e.name,e.errorID];
 values.forEach((input,index)=>{
  rows.push({id:label+'-'+'inspect-'+index,value:holder['inspect'+label](input)});
  holder['value'+label]=first;let failure=null,result:unknown=undefined;
  try{result=holder['accept'+label](input);}catch(e){failure=error(e);}
  rows.push({id:label+'-'+'accept-'+index,error:failure,value:[holder['value'+label]===first,holder['value'+label]===input,holder['value'+label]===null,result===input,result===undefined]});
  holder['value'+label]=first;failure=null;
  try{as3SetProperty(holder,'value'+label,input);}catch(e){failure=error(e);}
  rows.push({id:label+'-'+'field-'+index,error:failure,value:[holder['value'+label]===first,holder['value'+label]===input,holder['value'+label]===null]});
 });
 const calls:string[]=[],hooks={valueOf(){calls.push('value');return first;},toString(){calls.push('string');return 'implementation';}};
 let failure=null;holder['value'+label]=first;
 try{holder['accept'+label](hooks);}catch(e){failure=error(e);}
 rows.push({id:label+'-'+'hooks',error:failure,value:[holder['value'+label]===first,calls]});
 failure=null;try{as3SetProperty(holder,'view'+label,second);}catch(e){failure=error(e);}
 rows.push({id:label+'-'+'readonly',error:failure,value:[holder['view'+label]===first]});
 check(label==='LoaderInfo'?Object.isFrozen(token)&&getAS3DeclarationType(Implementation)===token:getAS3DeclarationType(Implementation)===undefined,'exact canonical token');
 check(label==='LoaderInfo'?getAS3SourceBase(Implementation)===EventDispatcherDeclaration:getAS3DeclarationType(Implementation)===undefined,'authenticated ancestry only');
 check(describeRegisteredFlashType(Implementation)==null,'reference binding must not invent reflection');
 check(values.every(value=>as3Is(value,token)===as3Is(value,Implementation)),'constructor/token agreement');
 const sameName=declareAS3ReferenceType(token.name);
 check(!as3Is(first,sameName.type),'name alone is not authority');
 let traps=0;const proxy=new Proxy(first,{get(){traps++;throw Error('get trap');},getPrototypeOf(){traps++;throw Error('prototype trap');}});
 const revoked=Proxy.revocable(first,{});revoked.revoke();
 for(const bad of [Object.create(Implementation.prototype),proxy,revoked.proxy]){
  let rejected=false;holder['value'+label]=first;try{holder['accept'+label](bad);}catch(e){rejected=(e as any).errorID===1034;}
  check(rejected&&holder['value'+label]===first&&!as3Is(bad,token)&&as3As(bad,token)===null,'reject forged receiver without mutation');
 }
 check(traps===0,'nominal checks avoid proxy traps');
 check(specs.every(spec=>spec[0]===label||!as3Is(spec[3],token)),'other value family rejected');
 holder['value'+label]=first;
 let rejected=false;try{holder['value'+label]=Object.create(Implementation.prototype);}catch(e){rejected=(e as any).errorID===1034;}
 check(rejected&&holder['value'+label]===first,'direct typed slot rejects counterfeit');

 check(holder['accept'+label](second)===second&&as3CoerceReference(second,token)===second,'retained nominal instance');
 }
 session.retire();
 (globalThis as any).result={rows,guards};
})();
