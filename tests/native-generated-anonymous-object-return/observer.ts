import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue,getAS3FunctionIntrinsic} from '@FLASH@/utils/AS3Invocation';
import {getQualifiedClassName} from '@FLASH@/utils/getQualifiedClassName';
import {as3CreateObjectLiteral} from '@FLASH@/utils/AS3Class';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('functions',domain);
 const Functions=domain.getDefinition('returncases.Functions');
 const invoke=(name,args=[])=>as3CallValue(get(Functions,name),()=>args);
 const call=(fn,receiver=null)=>as3CallValue(getAS3FunctionIntrinsic(fn,'call'),()=>[receiver]);
 const rows=[],row=(id,value)=>rows.push({id,value}),object=as3CreateObjectLiteral([['marker',17]]),array=[];
 const values=[undefined,null,false,true,0,-0,7.5,NaN,'','text',object,array];
 const labels=['undefined','null','false','true','zero','negative-zero','number','nan','empty-string','string','object','array'];
 values.forEach((value,i)=>{const result=call(invoke('capture',[value]));row(labels[i],[result===null,result===undefined,typeof result,result===value,String(result),1/result===Number.NEGATIVE_INFINITY]);});
 try{call(invoke('throwing',[undefined]));row('throw-undefined','returned');}catch(e){row('throw-undefined',[e===undefined,e===null]);}
 try{call(invoke('throwing',[object]));row('throw-object','returned');}catch(e){row('throw-object',e===object);}
 const receiver=invoke('receiver');row('receiver',[call(receiver,object)===object,getQualifiedClassName(call(receiver)),call(receiver)===call(receiver)]);
 let condition=invoke('conditional',[undefined,true]);row('conditional-return',[call(condition)===null,call(condition)===undefined]);
 condition=invoke('conditional',[object,false]);row('fallthrough',[call(condition)===null,call(condition)===undefined]);
 return {rows};
}
