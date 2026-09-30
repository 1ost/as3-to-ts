import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {Event} from '@FLASH@/utils/AS3CanonicalEventConstruction';
import {ErrorEvent} from '@FLASH@/utils/AS3CanonicalErrorEventReference';
import {IOErrorEvent} from '@FLASH@/events/IOErrorEvent';
import {SecurityErrorEvent} from '@FLASH@/events/SecurityErrorEvent';
import {TextEvent} from '@FLASH@/events/TextEvent';
import '@ENGINE@/tests/nativeCanonicalSpriteClass/init-imports';
import {Laya} from '@ENGINE@/src/layaAir/Laya';
import {Sprite} from '@FLASH@/display/Sprite';
export async function run(module:NativeSourceClassModule){
 await Laya.init(320,240);
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const domain=await session.load('constructors',new ApplicationDomain(ApplicationDomain.currentDomain));
 const classes=['OptionalErrorEvent','RequiredErrorEvent'].map(n=>domain.getDefinition('errorctors.'+n) as any);
 const rows:any[]=[];let conversions=0;
 const fake={toString(){conversions++;return 'event';}},original=new ErrorEvent('error',false,false,'detail',-7);
 const samples=[null,undefined,original,new IOErrorEvent('io'),new SecurityErrorEvent('security'),new IOErrorEvent('io').clone(),new Event('plain'),new TextEvent('text'),new Sprite(),{},fake,3,ErrorEvent.prototype,ErrorEvent,new Error('error'),original.clone()];
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
 for(const Kind of classes)for(const forged of [Object.create(ErrorEvent.prototype),new Proxy(original,{}),Object.assign({},original)]){
  Kind.bodies=0;try{new Kind(forged);throw Error('Forged event accepted');}catch(e:any){if(e.errorID!==1034)throw e;guards++;}
  if(Kind.bodies!==0)throw Error('Body entered before coercion');
 }
 session.retire();return{rows,guards};
}
