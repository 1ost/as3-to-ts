import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3EnumerableValues} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3VectorFromValues,as3VectorPrimitiveSpec} from '@FLASH@/utils/AS3Vector';
export async function run(module){
 const load=async domain=>{const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('enumeration',domain);return domain;};
 const domain=await load(new ApplicationDomain(ApplicationDomain.currentDomain)),def=n=>domain.getDefinition('classenum.'+n);
 const A=def('A'),B=def('B'),Scanner=def('Scanner'),call=(name,args)=>as3CallValue(get(Scanner,name),()=>args),rows=[],row=(id,value)=>rows.push({id,value});
 const label=v=>v===A?'A':v===B?'B':v===null?'null':'other',labels=v=>Array.from({length:get(v,'length')},(_,i)=>label(get(v,i)));
 const result=v=>[labels(get(v,0)),label(get(v,1)),get(v,2)===null?null:[get(get(v,2),'name'),get(get(v,2),'errorID')]];
 for(const [id,values,stop]of [['empty',[],false],['ordered-nullish',[A,B,null,undefined],false],['invalid-first',[{}],false],['invalid-middle',[B,{},A],false],['invalid-function',[function(){}],false],['break-before-invalid',[B,{}],true],['null-input',null,false]])row(id,result(call('scan',[values,stop])));
 const spec=as3VectorPrimitiveSpec('Class'),growing=as3VectorFromValues(spec,[A]),shrinking=as3VectorFromValues(spec,[A,B,A]);
 row('live-growth',[labels(call('live',[growing,false])),growing.length]);
 row('live-shrink',[labels(call('live',[shrinking,true])),shrinking.length]);
 const sibling=await load(new ApplicationDomain(ApplicationDomain.currentDomain)),child=await load(new ApplicationDomain(domain));
 const otherA=sibling.getDefinition('classenum.A'),otherScanner=sibling.getDefinition('classenum.Scanner');
 const other=as3CallValue(get(otherScanner,'scan'),()=>[[otherA],false]);
 let iteratorReads=0;const forged={0:A,length:1};Object.defineProperty(forged,Symbol.iterator,{get(){iteratorReads++;throw new Error('forged iterator read');}});
 const forgedValues=Array.from(as3EnumerableValues(forged));
 const domainChecks=[otherA!==A,otherScanner!==Scanner,get(get(other,0),0)===otherA,get(other,1)===otherA,child.getDefinition('classenum.A')===A,child.getDefinition('classenum.Scanner')===Scanner,iteratorReads===0,forgedValues.length===2&&forgedValues[0]===A&&forgedValues[1]===1];
 if(domainChecks.some(value=>value!==true))throw new Error('Class enumeration domain mismatch');
 return {rows,domainChecks};
}
