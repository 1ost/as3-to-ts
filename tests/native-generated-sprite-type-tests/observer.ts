import '@ENGINE@/tests/nativeDisplayProjection/entry';
import '@FLASH@/utils/AS3CanonicalSpriteConstruction';
import '@FLASH@/utils/AS3GeneratedMovieClipConstruction';
import {Sprite} from '@FLASH@/display/Sprite';
import {Shape} from '@FLASH@/display/Shape';
import {MovieClip} from '@FLASH@/display/MovieClip';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
export async function run(module:NativeSourceClassModule){
 const rows:any[]=[],checks:string[]=[],row=(id:string,value:unknown)=>rows.push({id,value});
 const check=(id:string,pass:boolean)=>{if(!pass)throw Error(id);checks.push(id);};
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const domain=await session.load('a',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Subject=domain.getDefinition('cases.SpriteTests') as any,s=new Subject(),sprite=new Sprite(),shape=new Shape(),movie=new MovieClip();
 row('sprite',[s.test(sprite),s.cast(sprite)===sprite]);
 row('movieclip',[s.test(movie),s.cast(movie)===movie]);
 row('shape',[s.test(shape),s.cast(shape)===null]);
 row('nullish',[s.test(null),s.test(undefined),s.cast(null)===null,s.cast(undefined)===null]);
 row('primitive',[s.test(1),s.test('x'),s.test(true),s.cast(1)===null,s.cast('x')===null,s.cast(true)===null]);
 row('object-class',[s.test({}),s.test(Sprite),s.cast({})===null,s.cast(Sprite)===null]);
 row('call-valid',[s.fromCall(sprite)===sprite,s.calls]);
 row('call-invalid',[s.fromCall(shape)===null,s.calls]);
 check('forged Sprite is rejected',s.test(Object.create(Sprite.prototype))===false);
 check('forged Sprite as rejected',s.cast(Object.create(Sprite.prototype))===null);
 const sibling=await session.load('b',new ApplicationDomain(ApplicationDomain.currentDomain));const Other=sibling.getDefinition('cases.SpriteTests') as any;
 check('separate subject Classes',Other!==Subject);check('shared native Sprite identity',new Other().cast(sprite)===sprite);
 session.retire();return {rows,checks};
}
