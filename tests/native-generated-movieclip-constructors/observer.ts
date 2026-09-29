import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import '@ENGINE@/tests/nativeCanonicalSpriteClass/init-imports';
import {Laya} from '@ENGINE@/src/layaAir/Laya';
import {Sprite} from '@FLASH@/utils/AS3GeneratedSpriteConstruction';
import {MovieClip} from '@FLASH@/utils/AS3GeneratedMovieClipConstruction';
import {Shape} from '@FLASH@/display/Shape';
import {Bitmap} from '@FLASH@/display/Bitmap';
import {TextField} from '@FLASH@/text/TextField';
import {EventDispatcher} from '@FLASH@/events/EventDispatcher';
export async function run(module:NativeSourceClassModule){
 await Laya.init(320,240);
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const domain=await session.load('constructors',new ApplicationDomain(ApplicationDomain.currentDomain));
 const classes=['OptionalMovieClip','RequiredMovieClip'].map(n=>domain.getDefinition('moviectors.'+n) as any);
 const ChildMovieClip=domain.getDefinition('moviectors.ChildMovieClip') as any;
 const rows:any[]=[];let conversions=0;
 const fake={toString(){conversions++;return '<fake/>';}};
 const samples=[null,undefined,new MovieClip(),new ChildMovieClip(),new Sprite(),new Shape(),new Bitmap(),new TextField(),new EventDispatcher(),{},fake,3,'sprite',MovieClip.prototype,ChildMovieClip.prototype];
 classes.forEach((Kind,c)=>{
  Kind.bodies=0;
  try{const empty=new Kind();rows.push({id:'default:'+c,value:[empty.saved===null,Kind.bodies]});}
  catch(e:any){rows.push({id:'default:'+c,value:[e.name,e.errorID,Kind.bodies]});}
  samples.forEach((value,i)=>{Kind.bodies=0;
   try{const item=new Kind(value);rows.push({id:c+':'+i,value:[item.saved===null,item.saved===value,Kind.bodies]});}
   catch(e:any){rows.push({id:c+':'+i,value:[e.name,e.errorID,Kind.bodies]});}
  });
  Kind.bodies=0;
  try{new Kind(null,null);rows.push({id:'extra:'+c,value:['accepted',Kind.bodies]});}
  catch(e:any){rows.push({id:'extra:'+c,value:[e.name,e.errorID,Kind.bodies]});}
 });
 rows.push({id:'conversions',value:conversions});
 let guards=0;
 for(const Kind of classes)for(const forged of [Object.create(Sprite.prototype),Object.create(ChildMovieClip.prototype),Object.create(MovieClip.prototype)]){
  Kind.bodies=0;try{new Kind(forged);throw Error('Forged MovieClip accepted');}catch(e:any){if(e.errorID!==1034)throw e;guards++;}
  if(Kind.bodies!==0)throw Error('Body entered before coercion');
 }
 session.retire();return {rows,guards};
}
