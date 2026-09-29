import {nativeSourceClassModule} from './sprite-position';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {Sprite} from '@FLASH@/display/Sprite';
import {as3Is} from '@FLASH@/utils/AS3Type';
import {describeRegisteredFlashType} from '@FLASH@/utils/FlashTypeMetadata';
import {getAS3GeneratedNativePositionAccessor} from '@FLASH@/utils/AS3GeneratedClass';
import {initializeRenderer} from '@RENDERER@';
export async function run(){
 await initializeRenderer();
 const session=createNativeSourceClassLoadingSession({resolve:()=>nativeSourceClassModule,maxModules:1});
 const module=await session.load('position-probe',new ApplicationDomain(ApplicationDomain.currentDomain));
 const OffsetSprite=module.getDefinition('positions.OffsetSprite') as any,SetterChild=module.getDefinition('positions.SetterChild') as any,GetterGrandchild=module.getDefinition('positions.GetterGrandchild') as any;
 const NativeGetter=module.getDefinition('positions.NativeGetter') as any,NativeSetter=module.getDefinition('positions.NativeSetter') as any;
 const state=(item:any)=>[item.x,item.y,item.basePosition()];
 try{
   var rows:any[]=[],a:any=new OffsetSprite(10,20),b:any=new OffsetSprite(-10,0);
   rows.push({id:"positive-constructor",value:state(a)});
   rows.push({id:"nonpositive-constructor",value:state(b)});
   a.x=40.5;a.y=-12.25;rows.push({id:"offset-write",value:state(a)});
   b.moveTo(-3.5,6.25);rows.push({id:"nonpositive-write",value:state(b)});
   a.writeBase(5,7);rows.push({id:"direct-super-write",value:state(a)});
   a.writeAsSprite(100,200);rows.push({id:"sprite-typed-dispatch",value:state(a)});
   a.writeAsObject("31.5",null);rows.push({id:"object-number-coercion",value:state(a)});
   var move:any=a.moveTo;move.call({},17,23);rows.push({id:"detached-method",value:state(a)});
   var s:any=new SetterChild();rows.push({id:"setter-constructor-dispatch",value:state(s)});
   s.x=40;rows.push({id:"setter-inherited-getter",value:state(s)});
   s.moveTo(50,60);rows.push({id:"setter-base-method-dispatch",value:state(s)});
   var g:any=new GetterGrandchild();rows.push({id:"grand-constructor-dispatch",value:state(g)});
   g.x=40;rows.push({id:"grand-inherited-setter",value:state(g)});
   g.moveTo(50,60);rows.push({id:"grand-base-method-dispatch",value:state(g)});
   g.writeBase(0,0);rows.push({id:"grand-direct-native-super",value:state(g)});
   const reflected=[a,s,g].map(item=>{const accessor=describeRegisteredFlashType(item.constructor)!.factory!.accessors!.find(a=>a.name==='x')!;return [accessor.access,accessor.type,accessor.declaredBy];});
   rows.push({id:'reflection',value:reflected});
   rows.push({id:"identity",value:[as3Is(a,Sprite),as3Is(s,Sprite),as3Is(s,OffsetSprite),as3Is(g,SetterChild),as3Is(g,OffsetSprite)]});
const ng=new NativeGetter();rows.push({id:'native-getter-default',value:ng.x});ng.x=20;rows.push({id:'native-getter-inherited-setter',value:ng.x});
 const ns=new NativeSetter();rows.push({id:'native-setter-default',value:ns.x});ns.x=20;rows.push({id:'native-setter-inherited-getter',value:ns.x});
 const guards=[];const rejects=(name:string,operation:()=>unknown)=>{try{operation();throw Error('accepted '+name);}catch(error:any){if(!String(error.message).includes('AS3_GENERATED_CLASS_UNSUPPORTED'))throw error;guards.push(name);}};
 const descriptor=Object.getOwnPropertyDescriptor(OffsetSprite.prototype,'x')!;
 rejects('getter receiver',()=>descriptor.get!.call({}));rejects('setter receiver',()=>descriptor.set!.call({},5));
 rejects('noncanonical native base',()=>getAS3GeneratedNativePositionAccessor(OffsetSprite,'x','get'));
 rejects('unqualified native property',()=>getAS3GeneratedNativePositionAccessor(Sprite,'width','get'));
 rejects('unknown accessor half',()=>getAS3GeneratedNativePositionAccessor(Sprite,'x','value' as any));
 return {rows,guards};
 }finally{session.retire();}
}
