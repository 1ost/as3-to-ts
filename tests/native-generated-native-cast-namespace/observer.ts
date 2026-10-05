import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {MovieClip} from '@FLASH@/utils/AS3CanonicalMovieClipReference';
import {Sprite} from '@FLASH@/display/Sprite';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 await session.load('cast-namespace',domain);const Reader=domain.getDefinition('castns.Reader'),rows=[],checks=[];
 const values=[new MovieClip(),null,undefined,{},new Sprite(),7];
 for(let i=0;i<values.length;i++){
  const reader=as3ConstructClass(Reader);
  try{const result=as3CallValue(get(reader,'run'),()=>[values[i]]);rows.push({id:'case:'+i,value:['value',result,get(reader,'calls'),get(reader,'seen')]});}
  catch(error){rows.push({id:'case:'+i,value:['error',error.name,error.errorID,get(reader,'calls'),get(reader,'seen')]});}
 }
 for(let i=0;i<values.length;i++){
  const reader=as3ConstructClass(Reader);
  try{const value=as3CallValue(get(reader,'cast'),()=>[values[i]]);rows.push({id:'cast:'+i,value:['value',value===values[i],value===null,get(reader,'seen')]});}
  catch(error){rows.push({id:'cast:'+i,value:['error',error.name,error.errorID,get(reader,'seen')]});}
 }
 for(const [i,value]of [new MovieClip(),null,{}].entries()){
  const reader=as3ConstructClass(Reader);
  try{as3CallValue(get(reader,'ordered'),()=>[value]);rows.push({id:'order:'+i,value:['value',get(reader,'seen')]});}
  catch(error){rows.push({id:'order:'+i,value:[typeof error==='string'?error:error.name,typeof error==='string'?0:error.errorID,get(reader,'seen')]});}
 }
 const otherDomain=new ApplicationDomain(ApplicationDomain.currentDomain),other=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 await other.load('cast-namespace',otherDomain);
 checks.push({name:'class-identity-isolated',passed:otherDomain.getDefinition('castns.Reader')!==Reader});
 const fresh=as3ConstructClass(Reader);checks.push({name:'instance-state-isolated',passed:get(fresh,'calls')===0&&get(fresh,'seen')===0});
 let traps=0;const forged=[Object.create(MovieClip.prototype),{constructor:MovieClip},new Proxy(values[0],{get(){traps++;throw Error('trap');},getPrototypeOf(){traps++;throw Error('trap');}})];
 let denied=0;for(const value of forged){try{as3CallValue(get(as3ConstructClass(Reader),'cast'),()=>[value]);}catch(error){if(error.errorID===1034)denied++;}}
 checks.push({name:'forged-native-identities-rejected-without-traps',passed:denied===3&&traps===0});
 session.retire();checks.push({name:'retained-instance-after-retirement',passed:as3CallValue(get(fresh,'run'),()=>[new MovieClip()]).length===5});other.retire();
 return {rows,checks};
}
