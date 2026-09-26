import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {isFlashMovieClip} from '@FLASH@/display/MovieClip';
import {isFlashSprite} from '@FLASH@/display/Sprite';
import {as3GetProperty,as3SetProperty} from '@FLASH@/utils/AS3Property';
export async function run(module: any): Promise<unknown> {
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const result=await session.load('main',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Child:any=result.getDefinition('SurfaceChild'),Log:any=result.getDefinition('ConstructionLog');
 const child=new Child(),rows=[{id:'subclass-construction',value:(as3GetProperty(Log,'rows') as unknown[]).slice()},
  {id:'subclass-result',value:[child.mark,child.trackAsMenu,child.enabled,child.currentFrame,child.totalFrames,child.numChildren]}];
 const guards:string[]=[];const check=(pass:unknown,label:string)=>{if(!pass)throw Error(label);guards.push(label);};
 check(isFlashMovieClip(child)&&isFlashSprite(child),'native allocation brands');
 check(Object.getPrototypeOf(child)===Child.prototype,'exact source prototype');
 const next=new Child();check(next.graphics!==child.graphics,'independent native state');
 check(as3GetProperty(child,'stop')===as3GetProperty(child,'stop'),'stable source native method closure');
 let error:any;try{as3SetProperty(child,'currentFrame',8);}catch(e){error=e;}
 check(error?.name==='ReferenceError'&&error?.errorID===1074,'inherited readonly source trait');
 session.retire();return {rows,guards};
}
