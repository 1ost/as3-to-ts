import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3VectorFromValues,as3VectorPrimitiveSpec} from '@FLASH@/utils/AS3Vector';
import {Error as SourceError} from '@FLASH@/utils/AS3CanonicalErrorConstruction';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('interface-write',domain);
 const make=name=>as3ConstructClass(domain.getDefinition('ifacewrite.'+name),[]),reader=make('Reader');
 const call=(name,...args)=>as3CallValue(get(reader,name),()=>args),rows=[];
 const record=(id,value)=>rows.push({id,value});
 const errorRow=(id,fn,tail)=>{try{fn();record(id,'missing error');}catch(e){record(id,[e.name,e.errorID,...tail()]);}};
 const names=['write','local','chain','writeOnly'],samples=[3.9,'7',4294967297,-2.9];
 let cell,holder,result,logs=[];
 for(const name of names)for(let i=0;i<samples.length;i++){
  cell=make('Cell');holder=make('Holder');set(holder,'cell',cell);
  result=call(name,name==='chain'?holder:cell,samples[i]);
  record(name+':'+i,[result,get(cell,'value'),get(cell,'events').slice(),get(holder,'hits'),call('ownValue')]);
 }
 cell=make('Cell');const converted={valueOf(){logs.push('convert');return 8.9;}};
 result=call('assign',cell,()=>{logs.push('rhs');return converted;});
 record('conversion-result',[result===converted,get(cell,'value'),logs.slice(),get(cell,'events').slice()]);
 logs=[];errorRow('null-direct',()=>call('assign',null,()=>{logs.push('rhs');return converted;}),()=>[logs.slice()]);
 logs=[];holder=make('Holder');errorRow('null-target',()=>call('assignChain',holder,()=>{logs.push('rhs');return converted;}),()=>[logs.slice(),get(holder,'hits')]);
 logs=[];errorRow('null-holder',()=>call('assignChain',null,()=>{logs.push('rhs');return 1;}),()=>[logs.slice()]);
 cell=make('Cell');let replacement=make('Cell');holder=make('Holder');set(holder,'cell',cell);
 result=call('assignChain',holder,()=>{set(holder,'cell',replacement);return 6.8;});
 record('captured-receiver',[result,get(cell,'value'),get(replacement,'value'),get(holder,'hits')]);
 cell=make('Cell');logs=[];errorRow('throwing-setter',()=>call('assign',cell,()=>{logs.push('rhs');return 13;}),()=>[logs.slice(),get(cell,'events').slice()]);
 cell=make('Cell');logs=[];errorRow('throwing-rhs',()=>call('assign',cell,()=>{logs.push('rhs');throw new SourceError('rhs');}),()=>[logs.slice(),get(cell,'events').slice()]);
 cell=make('Cell');const vector=as3VectorFromValues(as3VectorPrimitiveSpec('int'),[2,3]);result=call('writeItems',cell,vector);
 record('vector-identity',[result===vector,get(cell,'items')===vector,get(cell,'items').length]);
 result=call('writeItems',cell,null);record('vector-null',[result===null,get(cell,'items')===null]);
 result=call('writeItems',cell,undefined);record('vector-undefined',[result===undefined,get(cell,'items')===null]);
 errorRow('vector-wrong',()=>call('writeItems',cell,[]),()=>[get(cell,'items')===null]);
 cell=make('Cell');replacement=make('Cell');set(cell,'value',4);set(cell,'items',vector);
 result=call('copy',cell,replacement);record('copy',[result===replacement,get(replacement,'value'),get(replacement,'items')!==vector,get(replacement,'items').length,get(replacement,'items')[0],call('ownValue')]);
 return {rows};
}
