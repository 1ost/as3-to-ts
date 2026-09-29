import {nativeSourceClassModule} from './parent-removal';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {Sprite} from '@FLASH@/display/Sprite';
import {initializeRenderer} from '@RENDERER@';
export async function run(){
 await initializeRenderer();
 const session=createNativeSourceClassLoadingSession({resolve:()=>nativeSourceClassModule,maxModules:1});
 const module=await session.load('removal-probe',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Child=module.getDefinition('removal.Child') as any;
 const errorOf=(fn:()=>unknown)=>{try{fn();return 'none';}catch(e:any){return e.name+':'+(e.errorID??0);}};
 try{
   var rows:any[]=[],a:any=new Child(),p:any=new Sprite(),q:any=new Sprite();
   p.addChild(a);rows.push({id:"implicit",value:[a.removeSelf(),p.numChildren,a.parent===null]});
   p.addChild(a);rows.push({id:"explicit",value:[a.removeExplicit(),p.numChildren,a.parent===null]});
   p.addChild(a);rows.push({id:"typed-other",value:[a.removeOther(a),p.numChildren,a.parent===null]});
   rows.push({id:"guarded-null",value:a.guarded()});
   p.addChild(a);rows.push({id:"guarded-attached",value:[a.guarded(),p.numChildren]});
   rows.push({id:"null-parent",value:errorOf(function():void{a.removeSelf();})});
   rows.push({id:"null-root",value:errorOf(function():void{a.removeOther(null);})});
   var count:number=0;
   var failure:string=errorOf(function():void{a.removeArgument(function():any{count++;return a;});});
   rows.push({id:"arguments-before-null",value:[failure,count]});
   failure=errorOf(function():void{a.removeArgument(function():any{count++;throw new Error("argument");});});
   rows.push({id:"throw-before-null",value:[failure,count]});
   p.addChild(a);
   failure=errorOf(function():void{a.removeArgument(function():any{q.addChild(a);return a;});});
   rows.push({id:"parent-captured-before-argument",value:[failure,p.numChildren,q.numChildren,a.parent===q]});
   q.removeChild(a);p.addChild(a);var bound:any=a.removeSelf;
   rows.push({id:"bound-source-method",value:[bound.call({}),p.numChildren,a.parent===null]});
   var shadow:any={removeChild:function(value:any):string{return value===a?"shadow":"wrong";}};
   rows.push({id:"shadowed-parent",value:a.shadow(shadow)});
return {rows};
 }finally{session.retire();}
}
