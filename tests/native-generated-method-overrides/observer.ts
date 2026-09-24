// Host adapter only. All three subject classes are generated from complete AIR sources.
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty} from '@FLASH@/utils/AS3Property';
import {as3Is} from '@FLASH@/utils/AS3Type';
import {as3CallValue,getAS3FunctionLength,getAS3FunctionIntrinsic} from '@FLASH@/utils/AS3Invocation';
import {describeRegisteredFlashType} from '@FLASH@/utils/FlashTypeMetadata';

export async function run(parentModule:NativeSourceClassModule,childModule:NativeSourceClassModule){
 const rows:{id:string,value:unknown}[]=[],checks:string[]=[];
 const row=(id:string,value:unknown)=>rows.push({id,value});
 const check=(id:string,value:boolean)=>{if(!value)throw Error(id);checks.push(id);};
 const parentSession=createNativeSourceClassLoadingSession({resolve:()=>parentModule,maxModules:1});
 const root=ApplicationDomain.currentDomain,parent=await parentSession.load('parent',root);
 const Base=parent.getDefinition('overrides.Base') as Function;
 const domain=new ApplicationDomain(root);
 const session=createNativeSourceClassLoadingSession({resolve:()=>childModule,maxModules:2});
 const loaded=await session.load('child',domain);
 const Child=loaded.getDefinition('overrides.Child') as Function,Grandchild=loaded.getDefinition('overrides.Grandchild') as Function;
 check('selected parent reused',loaded.getDefinition('overrides.Base')===Base && Object.getPrototypeOf(Child.prototype)===Base.prototype);
 const p=Reflect.construct(Child,[]),base=p,other=Reflect.construct(Child,[]);
 const state=(v:any)=>[v.calls,v.baseCalls,v.value];
 const call=(v:unknown,name:string,args:unknown[]=[])=>as3CallValue(as3GetProperty(v,name),()=>args);
 row('defaults',state(p));call(base,'parse',['first']);row('base-dispatch',state(p));
 row('label-dispatch',[call(p,'label'),call(base,'label')]);
 const callback=as3GetProperty(base,'parse') as Function;
 row('closure-identity',[callback===as3GetProperty(base,'parse'),callback===as3GetProperty(p,'parse'),callback===as3GetProperty(other,'parse'),getAS3FunctionLength(callback)]);
 as3CallValue(getAS3FunctionIntrinsic(callback,'call'),()=>[other,'second']);row('bound-receiver',[state(p),state(other)]);
 as3CallValue(callback,()=>[null]);row('null-argument',state(p));
 const plain=Reflect.construct(Base,[]);call(plain,'parse',['base']);row('base-behavior',[state(plain),call(plain,'label')]);
 const grand=Reflect.construct(Grandchild,[]);call(grand,'parse',['grand']);row('transitive',[state(grand),call(grand,'label'),as3Is(grand,Base),as3Is(grand,Child)]);
 const methods=(v:unknown)=>describeRegisteredFlashType(v)!.methods.map(m=>[m.name,m.declaredBy]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
 row('child-methods',methods(p));row('grandchild-methods',methods(grand));
 const sibling=await session.load('sibling',new ApplicationDomain(root));
 check('sibling own Class remains distinct',sibling.getDefinition('overrides.Child')!==Child);
 check('sibling uses same parent Class',Object.getPrototypeOf((sibling.getDefinition('overrides.Child') as Function).prototype)===Base.prototype);
 session.retire();check('parent survives child retirement',root.getDefinition('overrides.Base')===Base);
 as3CallValue(callback,()=>['retained']);check('retained callback after retirement',p.calls===4 && p.value==='retained' && other.calls===0);
 parentSession.retire();return {rows,checks};
}
