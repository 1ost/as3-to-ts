import '@ENGINE@/tests/nativeCanonicalSpriteClass/init-imports';
import {Laya} from '@ENGINE@/src/layaAir/Laya';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {TextLine} from '@FLASH@/utils/AS3CanonicalTextLineReference';
import {TextBlock,GraphicElement} from '@FLASH@/text/engine/ContentTree';
import {ElementFormat} from '@FLASH@/text/engine/ElementFormat';
import {FontDescription} from '@FLASH@/text/engine/FontDescription';
import {Sprite} from '@FLASH@/display/Sprite';
import {Shape} from '@FLASH@/display/Shape';
import {MouseEvent} from '@FLASH@/utils/AS3GeneratedMouseEventConstruction';
import {Event} from '@FLASH@/utils/AS3CanonicalEventConstruction';
export async function run(module){
 await Laya.init(320,240);
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const domain=await session.load('types',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Reader=domain.getDefinition('typeops.Reader') as any,Child=domain.getDefinition('typeops.MouseChild') as any,reader=new Reader();
 const rows:any[]=[];let conversions=0;
 const block=new TextBlock(new GraphicElement(new Shape(),20,10,new ElementFormat(new FontDescription('Arial'),12)));
 const line=block.createTextLine(null,25),mouse=new MouseEvent('mouse'),child=new Child('child');
 const fake={toString(){conversions++;return 'mouse';},valueOf(){conversions++;return line;}};
 const samples=[null,undefined,line,mouse,child,new Event('other'),new Sprite(),new Shape(),{},fake,3,'text',MouseEvent,TextLine,MouseEvent.prototype,TextLine.prototype,true];
 for(const name of ['mouse','line'])for(let i=0;i<samples.length;i++){reader.effects=0;rows.push({id:name+':'+i,value:reader[name](samples[i])});}
 for(const name of ['chooseMouse','chooseLine'])for(const flag of [false,true]){reader.effects=0;const chosen=reader[name](flag,name==='chooseMouse'?mouse:line);rows.push({id:name+':'+flag,value:[chosen,reader.effects]});}
 const thrown={tag:'failure'};
 for(const name of ['throwMouse','throwLine']){reader.effects=0;try{reader[name](thrown);rows.push({id:name,value:[false,reader.effects]});}catch(error){rows.push({id:name,value:[error===thrown,reader.effects]});}}
 rows.push({id:'conversions',value:conversions});
 block.releaseLines(line,line);reader.effects=0;rows.push({id:'released',value:reader.line(line)});
 const reused=block.recreateTextLine(line,null,25);reader.effects=0;rows.push({id:'recreated',value:[reused===line,reader.line(reused)]});
 let hostGuards=0,hostFailures=0;
 for(const [name,value]of [['mouse',mouse],['line',line]])for(const fake of [Object.create(Object.getPrototypeOf(value)),new Proxy(value as object,{}),Object.assign({},value)]){
  reader.effects=0;const result=reader[name as string](fake);if(JSON.stringify(result)===JSON.stringify([false,false,true,2]))hostGuards++;else hostFailures++;
 }
 session.retire();return {rows,hostGuards,hostFailures};
}
