import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {TextLine} from '@FLASH@/utils/AS3CanonicalTextLineReference';
import {TextBlock,GraphicElement} from '@FLASH@/text/engine/ContentTree';
import {ElementFormat} from '@FLASH@/text/engine/ElementFormat';
import {FontDescription} from '@FLASH@/text/engine/FontDescription';
import '@ENGINE@/tests/nativeCanonicalSpriteClass/init-imports';
import {Laya} from '@ENGINE@/src/layaAir/Laya';
import {Sprite} from '@FLASH@/display/Sprite';
import {Shape} from '@FLASH@/display/Shape';
export async function run(module:NativeSourceClassModule){
 await Laya.init(320,240);
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const domain=await session.load('constructors',new ApplicationDomain(ApplicationDomain.currentDomain));
 const classes=['OptionalLine','RequiredLine'].map(n=>domain.getDefinition('linectors.'+n) as any);
 const rows:any[]=[];let conversions=0;
 const block=new TextBlock(new GraphicElement(new Shape(),20,10,new ElementFormat(new FontDescription('Arial'),12)));
 const line=block.createTextLine(null,25);
 const fake={toString(){conversions++;return 'line';}};
 const samples=[null,undefined,line,new Sprite(),new Shape(),{},{textBlock:block,atomCount:1},fake,3,'line',TextLine,TextLine.prototype];
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
 block.releaseLines(line,line);const released=new classes[0](line);
 rows.push({id:'released',value:[released.saved===line,released.saved.textBlock===null]});
 const reused=block.recreateTextLine(line,null,25),recreated=new classes[1](reused);
 rows.push({id:'recreated',value:[recreated.saved===line,recreated.saved===reused]});
 let guards=0;
 for(const Kind of classes)for(const forged of [Object.create(TextLine.prototype),new Proxy(line,{}),Object.assign({},line)]){
  Kind.bodies=0;try{new Kind(forged);throw Error('Forged TextLine accepted');}catch(e:any){if(e.errorID!==1034)throw e;guards++;}
  if(Kind.bodies!==0)throw Error('Body entered before coercion');
 }
 session.retire();return{rows,guards};
}
