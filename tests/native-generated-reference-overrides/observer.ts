import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty} from '@FLASH@/utils/AS3Property';
import {as3Is} from '@FLASH@/utils/AS3Type';
import {as3CallValue,getAS3FunctionLength,getAS3FunctionIntrinsic} from '@FLASH@/utils/AS3Invocation';
export async function run(parentModule:NativeSourceClassModule,childModule:NativeSourceClassModule){
 const rows:{id:string,value:unknown}[]=[],checks:string[]=[];
 const row=(id:string,value:unknown)=>rows.push({id,value});
 const check=(id:string,value:boolean)=>{if(!value)throw Error(id);checks.push(id);};
 const parentSession=createNativeSourceClassLoadingSession({resolve:()=>parentModule,maxModules:2});
 const root=new ApplicationDomain(ApplicationDomain.currentDomain),parent=await parentSession.load('parent',root);
 const Base=parent.getDefinition('refov.Base') as Function,Value=parent.getDefinition('refov.Value') as Function,IValue=parent.getDefinition('refov.IValue');
 const session=createNativeSourceClassLoadingSession({resolve:()=>childModule,maxModules:3});
 const loaded=await session.load('child',new ApplicationDomain(root));
 const Child=loaded.getDefinition('refov.Child') as Function,Grandchild=loaded.getDefinition('refov.Grandchild') as Function;
 check('selected parent reused',loaded.getDefinition('refov.Base')===Base&&Object.getPrototypeOf(Child.prototype)===Base.prototype);
 check('signature references reused',loaded.getDefinition('refov.IValue')===IValue&&loaded.getDefinition('refov.Value')===Value);
 const child=Reflect.construct(Child,[]),value=Reflect.construct(Value,[]),other=Reflect.construct(Child,[]);
 const call=(target:unknown,name:string,args:unknown[]=[])=>as3CallValue(as3GetProperty(target,name),()=>args);
 row('defaults',[child.calls,child.baseCalls,child.stored===null]);
 row('interface-dispatch',[call(child,'accept',[value])===value,child.calls,child.baseCalls,child.stored===value]);
 row('class-dispatch',call(child,'echo',[value])===value);
 const callback=as3GetProperty(child,'accept') as Function;
 row('closure',[callback===as3GetProperty(child,'accept'),callback===as3GetProperty(other,'accept'),getAS3FunctionLength(callback)]);
 row('bound',[as3CallValue(getAS3FunctionIntrinsic(callback,'call'),()=>[other,value])===value,child.calls,other.calls]);
 row('null',[as3CallValue(callback,()=>[null])===null,child.stored===null,child.calls]);
 row('undefined',[as3CallValue(callback,()=>[undefined])===null,child.stored===null,child.calls]);
 try{as3CallValue(callback,()=>[{}]);row('invalid-interface','unexpected');}catch(e:any){row('invalid-interface',[e.name,e.errorID,child.calls]);}
 try{call(child,'echo',[{}]);row('invalid-class','unexpected');}catch(e:any){row('invalid-class',[e.name,e.errorID]);}
 const grand=Reflect.construct(Grandchild,[]);
 row('transitive',[call(grand,'accept',[value])===value,grand.calls,grand.baseCalls,grand.stored===value,as3Is(grand,Base),as3Is(grand,Child)]);
 const sibling=await session.load('sibling',new ApplicationDomain(root));
 check('sibling class distinct',sibling.getDefinition('refov.Child')!==Child);
 check('sibling uses selected references',sibling.getDefinition('refov.IValue')===IValue);
 const isolated=await parentSession.load('isolated',new ApplicationDomain(null));
 const Foreign=isolated.getDefinition('refov.Value') as Function;
 check('isolated references distinct',Foreign!==Value&&isolated.getDefinition('refov.IValue')!==IValue);
 let rejected=false;try{call(child,'accept',[Reflect.construct(Foreign,[])]);}catch(e:any){rejected=e.name==='TypeError'&&e.errorID===1034;}
 check('same names do not grant membership',rejected&&child.calls===4);
 session.retire();check('retained callback',as3CallValue(callback,()=>[value])===value&&child.calls===5);
 parentSession.retire();return {rows,checks};
}
