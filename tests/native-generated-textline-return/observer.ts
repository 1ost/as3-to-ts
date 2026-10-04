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
import {AS3Error} from '@FLASH@/errors/AS3SourceError';
export async function run(module:NativeSourceClassModule){
 await Laya.init(320,240);
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const domain=await session.load('returns',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Subject=domain.getDefinition('linereturn.Subject') as any,subject=new Subject();
 const rows:any[]=[];let conversions=0;
 const block=new TextBlock(new GraphicElement(new Shape(),20,10,new ElementFormat(new FontDescription('Arial'),12)));
 const line=block.createTextLine(null,25);
 const fake={toString(){conversions++;return 'line';},valueOf(){conversions++;return line;}};
 const samples=[null,undefined,line,new Sprite(),new Shape(),{},{textBlock:block,atomCount:1},fake,3,'line',TextLine,TextLine.prototype];
 const names=['direct','protectedBridge','privateBridge','viaFinally','staticLine','line'];
 for(const name of names)for(let i=0;i<samples.length;i++){
  subject.effects=0;subject.value=samples[i];
  try{const result=name==='staticLine'?Subject.staticLine(samples[i]):name==='line'?subject.line:subject[name](samples[i]);rows.push({id:name+':'+i,value:[result===null,result===samples[i],subject.effects]});}
  catch(e:any){rows.push({id:name+':'+i,value:[e.name,e.errorID,subject.effects]});}
 }
 const cases:any[]=[['optional',[]],['direct',[]],['direct',[line,line]],['fallthrough',[false,line]],['fallthrough',[true,line]],['replaceFinally',[{},line]],['replaceFinally',[line,{}]],['fromCall',[()=>line]],['fromCall',[()=>({})]],['throwing',[new AS3Error('probe')]]];
 cases.forEach(([name,args],i)=>{subject.effects=0;try{const result=subject[name].apply(subject,args);rows.push({id:'case:'+i,value:[result===null,result===line,subject.effects]});}catch(e:any){rows.push({id:'case:'+i,value:[e.name,e.errorID,subject.effects]});}});
 rows.push({id:'conversions',value:conversions});
 block.releaseLines(line,line);rows.push({id:'released',value:subject.direct(line)===line});
 const reused=block.recreateTextLine(line,null,25);rows.push({id:'recreated',value:[subject.direct(reused)===line,reused===line]});
 let hostGuards=0,hostFailures=0;
 for(const value of [Object.create(TextLine.prototype),new Proxy(line,{}),Object.assign({},line)]){
  subject.effects=0;try{subject.direct(value);throw Error('Forged TextLine accepted');}catch(e:any){if(e.errorID===1034)hostGuards++;else hostFailures++;}
  if(subject.effects!==1)hostFailures++;
 }
 session.retire();return {rows,hostGuards,hostFailures};
}
