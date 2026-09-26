import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty} from '@FLASH@/utils/AS3Property';
import {as3CallValue,getAS3FunctionLength,getAS3FunctionIntrinsic} from '@FLASH@/utils/AS3Invocation';
export async function run(parentModule:NativeSourceClassModule,childModule:NativeSourceClassModule){
 const rows:{id:string,value:unknown}[]=[],checks:string[]=[];
 const row=(id:string,value:unknown)=>rows.push({id,value});
 const check=(id:string,value:boolean)=>{if(!value)throw Error(id);checks.push(id);};
 const parentSession=createNativeSourceClassLoadingSession({resolve:()=>parentModule,maxModules:1});
 const root=ApplicationDomain.currentDomain,parent=await parentSession.load('parent',root);
 const Base=parent.getDefinition('optov.Base') as Function;
 const session=createNativeSourceClassLoadingSession({resolve:()=>childModule,maxModules:2});
 const loaded=await session.load('child',new ApplicationDomain(root));
 const Child=loaded.getDefinition('optov.Child') as Function,Grandchild=loaded.getDefinition('optov.Grandchild') as Function;
 check('selected parent reused',loaded.getDefinition('optov.Base')===Base&&Object.getPrototypeOf(Child.prototype)===Base.prototype);
 const child=Reflect.construct(Child,[]),other=Reflect.construct(Child,[]);
 const state=(v:any)=>[v.start,v.end,v.calls];
 const call=(v:unknown,name:string,args:unknown[]=[])=>as3CallValue(as3GetProperty(v,name),()=>args);
 call(child,'range');row('virtual-defaults',state(child));
 call(child,'range',[3]);row('partial',state(child));
 call(child,'range',[undefined,undefined]);row('undefined',state(child));
 call(child,'parentDefaults');row('super-defaults',state(child));
 row('label',[call(child,'label',['x']),call(child,'label',['x',undefined]),call(Reflect.construct(Base,[]),'label',['x'])]);
 const callback=as3GetProperty(child,'range') as Function,label=as3GetProperty(child,'label') as Function;
 row('closure',[callback===as3GetProperty(child,'range'),callback===as3GetProperty(other,'range'),getAS3FunctionLength(callback),getAS3FunctionLength(label)]);
 as3CallValue(getAS3FunctionIntrinsic(callback,'call'),()=>[other]);row('bound',[state(child),state(other)]);
 row('reference',[call(child,'reference')===null,call(child,'reference',[undefined])===null,call(child,'reference',[child])===child]);
 const grand=Reflect.construct(Grandchild,[]);call(grand,'range');row('transitive',state(grand));
 try{as3CallValue(callback,()=>[1,2,3]);row('extra','unexpected');}catch(e:any){row('extra',[e.name,e.errorID,child.calls]);}
 try{as3CallValue(label,()=>[]);row('missing','unexpected');}catch(e:any){row('missing',[e.name,e.errorID]);}
 const sibling=await session.load('sibling',new ApplicationDomain(root));
 check('sibling own Class distinct',sibling.getDefinition('optov.Child')!==Child);
 check('sibling parent reused',Object.getPrototypeOf((sibling.getDefinition('optov.Child') as Function).prototype)===Base.prototype);
 session.retire();check('parent survives child retirement',root.getDefinition('optov.Base')===Base);
 as3CallValue(callback,()=>[]);check('retained defaults',child.start===5&&child.end===7&&child.calls===56);
 parentSession.retire();return {rows,checks};
}
