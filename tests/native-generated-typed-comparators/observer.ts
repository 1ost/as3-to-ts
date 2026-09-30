import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue,getAS3FunctionIntrinsic} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructValue} from '@FLASH@/utils/AS3Invocation';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 await session.load('comparators',domain);
 try{
  const make=(name,args=[])=>as3ConstructValue(domain.getDefinition('comparecases.'+name),()=>args);
  const factory=make('Functions'),first=make('Item',[7.75]),second=make('Item',[2]);
  const invoke=(name,args=[])=>as3CallValue(get(factory,name),()=>args);
  const call=(fn,...args)=>as3CallValue(getAS3FunctionIntrinsic(fn,'call'),()=>[null,...args]);
  const rows=[],add=(id,value)=>rows.push({id,value}),error=e=>[get(e,'name'),get(e,'errorID')],fn=invoke('make');
  add('numeric',[call(fn,first,second),call(fn,second,first),get(fn,'length')]);
  add('fresh',[fn===invoke('make'),fn===fn]);add('subtype',call(fn,make('Child',[9.5]),second));
  add('overflow',call(fn,make('Item',[4294967297]),make('Item',[0])));add('nan',call(fn,make('Item',[NaN]),second));
  for(const [id,args]of [['extra',[first,second,'extra']],['missing-all',[]],['missing-second',[first]],['plain-object',[{},second]],['unrelated-class',[make('Other'),second]],['null',[null,second]],['undefined',[undefined,second]],['coercion-before-body',[null,{}]]]){
   try{call(fn,...args);add(id,'accepted');}catch(e){add(id,error(e));}
  }
  add('call-apply',[as3CallValue(getAS3FunctionIntrinsic(fn,'call'),()=>[{},first,second]),as3CallValue(getAS3FunctionIntrinsic(fn,'apply'),()=>[null,[second,first]])]);
  const closure=invoke('capture',[3.5]);add('capture',[call(closure,first,second),call(closure,second,first)]);
  for(const [id,value]of [['return-string','4294967298'],['return-undefined',undefined],['return-null',null],['return-infinity',Infinity]])add(id,call(invoke('constant',[value])));
  add('fallthrough',[call(invoke('fallthrough'),null),call(invoke('fallthrough'),first)]);
  try{add('zero-extra',call(invoke('constant',[5]),'extra'));}catch(e){add('zero-extra',error(e));}
  const wildcard=invoke('wildcard');add('wildcard',call(wildcard,'4294967298'));
  try{add('wildcard-missing',call(wildcard));}catch(e){add('wildcard-missing',error(e));}
  try{add('wildcard-extra',call(wildcard,4,5));}catch(e){add('wildcard-extra',error(e));}
  add('mixed',call(invoke('mixed'),first,3.5));
  add('reassign',call(invoke('reassign'),null,make('Child',[8.5])));
  try{call(invoke('reassign'),first,{});add('reassign-bad','accepted');}catch(e){add('reassign-bad',error(e));}
  try{call(invoke('throwing'),first);add('throw','returned');}catch(e){add('throw',e===first);}
  const items=[make('Item',[3]),make('Item',[1]),make('Child',[2])],sorted=invoke('sorted',[items]);
  add('sort',[sorted===items,...items.map(item=>get(item,'rank'))]);return {rows};
 }finally{session.retire();}
}
