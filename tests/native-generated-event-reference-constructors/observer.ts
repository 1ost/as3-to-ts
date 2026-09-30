import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {Event} from '@FLASH@/utils/AS3CanonicalEventConstruction';
import {MouseEvent} from '@FLASH@/utils/AS3GeneratedMouseEventConstruction';
import {KeyboardEvent} from '@FLASH@/utils/AS3CanonicalInteractionEventReferences';
import '@ENGINE@/tests/nativeCanonicalSpriteClass/init-imports';
import {Laya} from '@ENGINE@/src/layaAir/Laya';
import {Sprite} from '@FLASH@/display/Sprite';
export async function run(module:NativeSourceClassModule){
 await Laya.init(320,240);
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const domain=await session.load('constructors',new ApplicationDomain(ApplicationDomain.currentDomain));
 const classes=['OptionalEvent','RequiredEvent','OptionalMouseEvent','RequiredMouseEvent'].map(n=>domain.getDefinition('eventctors.'+n) as any);
 const Derived=domain.getDefinition('eventctors.DerivedMouse') as any;
 const rows:any[]=[];let conversions=0;
 const fake={toString(){conversions++;return 'event';}},mouse=new MouseEvent('mouse');
 const samples=[null,undefined,new Event('plain'),mouse,new Derived(),new KeyboardEvent('key'),new Sprite(),{},{type:'fake'},fake,3,Event.prototype,MouseEvent.prototype,MouseEvent];
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
 for(const Kind of classes)for(const forged of [Object.create(MouseEvent.prototype),new Proxy(mouse,{}),Object.assign({},mouse)]){
  Kind.bodies=0;try{new Kind(forged);throw Error('Forged event accepted');}catch(e:any){if(e.errorID!==1034)throw e;guards++;}
  if(Kind.bodies!==0)throw Error('Body entered before coercion');
 }
 session.retire();return{rows,guards};
}
