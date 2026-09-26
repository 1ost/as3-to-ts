// Host adapter reproduces the AIR probe; all five subjects use complete source factories.
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty,as3SetProperty} from '@FLASH@/utils/AS3Property';
import {as3Is} from '@FLASH@/utils/AS3Type';
import {as3CallValue,getAS3FunctionIntrinsic} from '@FLASH@/utils/AS3Invocation';
import {describeRegisteredFlashType} from '@FLASH@/utils/FlashTypeMetadata';
export async function run(parentModule:NativeSourceClassModule,childModule:NativeSourceClassModule){
 const rows:{id:string,value:unknown}[]=[],checks:string[]=[];
 const row=(id:string,value:unknown)=>rows.push({id,value});
 const check=(id:string,value:boolean)=>{if(!value)throw Error(id);checks.push(id);};
 const parentSession=createNativeSourceClassLoadingSession({resolve:()=>parentModule,maxModules:1});
 const root=ApplicationDomain.currentDomain,parent=await parentSession.load('parent',root);
 const Base=parent.getDefinition('accessors.Base') as Function;
 const session=createNativeSourceClassLoadingSession({resolve:()=>childModule,maxModules:2});
 const loaded=await session.load('child',new ApplicationDomain(root));
 const subject=(name:string)=>loaded.getDefinition('accessors.'+name) as Function;
 const SetterChild=subject('SetterChild'),GetterGrandchild=subject('GetterGrandchild'),GetterChild=subject('GetterChild'),CompleteChild=subject('CompleteChild');
 check('selected parent reused',subject('Base')===Base && Object.getPrototypeOf(SetterChild.prototype)===Base.prototype);
 const s=Reflect.construct(SetterChild,[]),g=Reflect.construct(GetterGrandchild,[]),r=Reflect.construct(GetterChild,[]),c=Reflect.construct(CompleteChild,[]);
 const get=(v:unknown)=>as3GetProperty(v,'enabled'),set=(v:unknown,value:unknown)=>as3SetProperty(v,'enabled',value);
 const call=(v:unknown,name:string,args:unknown[]=[])=>as3CallValue(as3GetProperty(v,name),()=>args);
 const clear=(v:any)=>v.trace.length=0,trace=(v:any)=>v.trace.concat();
 row('setter-read',[get(s),trace(s)]);clear(s);
 set(s,false);row('setter-write',[get(s),trace(s)]);clear(s);
 call(s,'write',[true]);row('base-dispatch',[call(s,'read'),trace(s)]);clear(s);
 row('super-read',[call(s,'readSuper'),trace(s)]);
 set(g,false);row('grand-inherit',[get(g),trace(g)]);clear(g);
 call(g,'write',[true]);row('grand-base-dispatch',[call(g,'read'),trace(g)]);
 set(r,false);row('getter-inherit',[get(r),trace(r)]);clear(r);
 call(r,'writeSuper',[true]);row('super-write',[get(r),trace(r)]);
 set(c,false);row('complete',[get(c),trace(c)]);
 clear(s);set(s,1);row('dynamic-coercion',[get(s),trace(s)]);
 row('reflection',[s,g,r,c].map(v=>{const a=describeRegisteredFlashType(v)!.accessors.find(a=>a.name==='enabled')!;return [a.access,a.type,a.declaredBy];}));
 clear(s);const read=as3GetProperty(s,'read'),write=as3GetProperty(s,'write');
 as3CallValue(getAS3FunctionIntrinsic(write,'call'),()=>[{},false]);
 row('bound',[as3CallValue(getAS3FunctionIntrinsic(read,'apply'),()=>[null,[]]),trace(s)]);
 row('identity',[as3Is(s,Base),as3Is(g,SetterChild),as3Is(g,Base),as3Is(r,SetterChild),as3Is(c,Base)]);
 const descriptor=Object.getOwnPropertyDescriptor(SetterChild.prototype,'enabled')!;
 let rejected=false;try{descriptor.get!.call(Object.create(SetterChild.prototype));}catch(error){rejected=String(error).includes('genuine source receiver');}
 check('forged getter rejected',rejected);
 rejected=false;try{descriptor.set!.call({},true);}catch(error){rejected=String(error).includes('genuine source receiver');}
 check('forged setter rejected',rejected);
 const sibling=await session.load('sibling',new ApplicationDomain(root));
 check('sibling distinct with same selected parent',sibling.getDefinition('accessors.SetterChild')!==SetterChild && Object.getPrototypeOf((sibling.getDefinition('accessors.SetterChild') as Function).prototype)===Base.prototype);
 session.retire();check('parent survives child retirement',root.getDefinition('accessors.Base')===Base);
 parentSession.retire();return {rows,checks};
}
