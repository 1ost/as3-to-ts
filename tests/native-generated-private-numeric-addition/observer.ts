import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {AS3Error} from '@FLASH@/errors/AS3SourceError';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('private-numeric-addition',domain);
 const make=name=>as3ConstructClass(domain.getDefinition('privadd.'+name),[]),a=make('Subject'),b=make('Subject');
 const call=(o,name,...args)=>as3CallValue(get(o,name),()=>args),strings=values=>values.map(String);
 const rows=[],observe=(id,fn)=>{try{rows.push({id,value:fn()});}catch(e){rows.push({id,value:[e.name,e.errorID]});}};
 observe('defaults',()=>strings(call(a,'state')));
 const inputs=[2.25,'2',null,undefined,true,false,-1.75,NaN,Infinity,-Infinity,0,-0,'','bad','0x10'];
 for(let i=0;i<inputs.length;i++){
  call(a,'reset',3.5,4294967295);
  observe('number-'+i,()=>strings(call(a,'addNumber',inputs[i])));
  observe('uint-'+i,()=>strings(call(a,'addUint',inputs[i])));
 }
 call(a,'reset',10,4294967295);call(b,'reset',100,100);set(a,'target',a);
 observe('routed-number',()=>strings(call(a,'routedNumber',()=>{set(a,'target',b);return '2';})));
 observe('routed-number-storage',()=>strings([call(a,'state')[0],call(b,'state')[0]]));
 set(a,'target',a);
 observe('routed-uint',()=>strings(call(a,'routedUint',()=>{set(a,'target',b);return 2;})));
 observe('routed-uint-storage',()=>strings([call(a,'state')[1],call(b,'state')[1]]));
 call(a,'reset',10,4294967295);
 observe('old-number-before-rhs',()=>strings(call(a,'orderNumber',()=>{call(a,'reset',90,4294967295);return 2;})));
 observe('old-uint-before-rhs',()=>strings(call(a,'orderUint',()=>{call(a,'reset',12,20);return 2;})));
 observe('throw-number',()=>call(a,'orderNumber',()=>{throw new AS3Error('rhs');}));
 observe('throw-uint',()=>call(a,'orderUint',()=>{throw new AS3Error('rhs');}));
 observe('after-throws',()=>strings(call(a,'state')));
 set(a,'target',null);let effects=0;
 observe('null-number',()=>call(a,'routedNumber',()=>{effects++;return 2;}));
 observe('null-uint',()=>call(a,'routedUint',()=>{effects++;return 2;}));
 observe('null-effects',()=>effects);
 const leading=make('Leading');call(a,'reset',1.25,0);
 observe('from-leading',()=>strings([call(a,'fromLeading',leading),get(leading,'reads')]));
 observe('null-leading',()=>call(a,'fromLeading',null));
 observe('after-leading',()=>strings([call(a,'state')[0],get(leading,'reads')]));
 observe('implicit',()=>strings(call(a,'implicit','2')));
 call(a,'reset',-0,0);const result=call(a,'addNumber',-0);
 observe('negative-zero',()=>strings([1/Number(result[1]),1/Number(result[2])]));
 return {rows};
}
