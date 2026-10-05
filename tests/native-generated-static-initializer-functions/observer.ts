import {as3String} from '@FLASH@/utils/AS3String';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3CallValue,registerAS3Function,getAS3FunctionIntrinsic,getAS3FunctionLength} from '@FLASH@/utils/AS3Invocation';
import {getAS3BuiltinScriptGlobal} from '@FLASH@/utils/AS3ScriptGlobal';
export async function run(module:NativeSourceClassModule){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('functions',domain);
 const Trace=domain.getDefinition('initfunctions.Trace'),holder=():any=>domain.getDefinition('initfunctions.Holder'),arr=(name:string):any=>get(Trace,name),item=(name:string,i:number):any=>get(arr(name),i),len=(name:string)=>get(arr(name),'length') as number,rows:any[]=[],row=(id:string,value:any)=>rows.push({id,value}),caller=getAS3BuiltinScriptGlobal();
 const invoke=(object:any,name:any,...args:any[])=>as3CallValue(get(object,name),()=>args,object),call=(fn:any,...args:any[])=>as3CallValue(fn,()=>args,caller);
 try{holder();row('first','accepted');}catch(e){if(e!==get(Trace,'failure'))throw e;row('first',[e===get(Trace,'failure'),len('classes')]);}
 const failed=item('classes',0),oldRead=item('callbacks',0),oldValue=call(oldRead),oldOwner=get(failed,'owner');
 row('failed-owner',[call(oldOwner)===null,call(oldOwner)===failed,oldValue!==null,typeof call(oldOwner),call(oldOwner)===undefined,as3String(call(oldOwner))]);
 set(Trace,'fail',false);const selected=holder(),newRead=get(selected,'read'),newValue=call(newRead);
 row('retry',[len('classes'),selected===failed,oldRead===newRead,oldValue===newValue,call(oldRead)===oldValue,call(newRead)===newValue]);row('retained-owner',[call(oldOwner)===null,call(oldOwner)===failed,invoke(selected,'owner')===selected,call(oldOwner)===selected]);
 const values=[];for(let i=0;i<10;i++)values.push(call(invoke(selected,'callback',i),'I','V','X'));row('digits',values);
 const fn:any=invoke(selected,'callback',4);row('signature',[getAS3FunctionLength(fn),fn===invoke(selected,'callback',4),fn===invoke(failed,'callback',4)]);row('conversions',[call(fn,1,2,3),call(fn,null,undefined,'X')]);
 const order:string[]=[],value=(tag:string,text:string)=>({toString:registerAS3Function(function(){order.push(tag);return text;},caller,0,'String')});
 row('conversion-order',[call(fn,value('a','I'),value('b','V'),value('c','X')),order.slice()]);
 try{call(fn,'I','V');}catch(e:any){row('too-few',[e.name,e.errorID]);}try{call(fn,'I','V','X','extra');}catch(e:any){row('too-many',[e.name,e.errorID]);}
 const receiver:any=get(selected,'receiver'),global=call(receiver),other={},intrinsic=(name:string,...args:any[])=>as3CallValue(getAS3FunctionIntrinsic(receiver,name),()=>args);
 row('receiver',[global!==null,global===intrinsic('call',null),intrinsic('call',other)===other,intrinsic('apply',other,[])===other]);row('zero-arity-extra',[getAS3FunctionLength(receiver),call(receiver,1,2)===global]);
 const ending=get(selected,'ending');row('implicit-return',[call(ending,''),call(ending,null),call(ending,7)]);row('once',[holder()===selected,len('classes')]);
 session.retire();return rows;
}