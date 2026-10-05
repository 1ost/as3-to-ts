import {as3GetProperty} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {ILaya} from '@FLASH@/../ILaya';
import {LayaGL} from '@FLASH@/../laya/layagl/LayaGL';
import {NoRender2DProcess} from '@FLASH@/../laya/RenderDriver/NoRenderDriver/2DRenderPass/NoRender2DProcess';
import {NoRenderDeviceFactory} from '@FLASH@/../laya/RenderDriver/NoRenderDriver/DriverDevice/NoRenderDeviceFactory';
import '@FLASH@/utils/AS3CanonicalSpriteProperties';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {Sprite} from '@FLASH@/display/Sprite';
import {Shape} from '@FLASH@/display/Shape';
import {Rectangle} from '@FLASH@/utils/AS3CanonicalRectangleReference';
const invoke=(fn,args)=>as3CallValue(as3GetProperty(fn,'apply'),()=>[null,args],fn);
export async function run(module){
 LayaGL.render2DRenderPassFactory=new NoRender2DProcess();LayaGL.renderDeviceFactory=new NoRenderDeviceFactory();
 ILaya.stage={_graphicUpdateList:new Set(),_tranMatrixUpdateList:new Set()} as any;
 ILaya.timer={callLater:()=>undefined} as any;ILaya.systemTimer={callLater:()=>undefined,runCallLater:()=>undefined} as any;
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1}),domain=await session.load('callbacks',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Reader=domain.getDefinition('callbacks.Reader') as any,rows=[],checks=[],sprite=new Sprite(),rect=new Rectangle(1,2,3,4);let conversions=0,effects=[],fn;
 const fake={toString(){conversions++;return 'fake';},valueOf(){conversions++;return rect;}};
 for(const mode of ['display','rectangle']){
  const samples=mode==='display'?[sprite,new Shape(),null,undefined,rect,{},fake,3]:[rect,new Rectangle(2,3,4,5),null,undefined,sprite,{},fake,3];
  for(let i=0;i<samples.length;i++){
   effects=[];fn=Reader[mode](effects);
   try{const result=invoke(fn,[samples[i]]);rows.push({id:mode+':'+i,value:[result===undefined,mode==='display'?[effects.length,effects[0]===samples[i],effects[0]===null]:effects]});}
   catch(e){rows.push({id:mode+':'+i,value:[e.name,e.errorID,effects.length]});}
  }
  for(const args of [[],[samples[0],samples[0]]]){effects=[];fn=Reader[mode](effects);try{invoke(fn,args);rows.push({id:mode+':arity:'+args.length,value:'accepted'});}catch(e){rows.push({id:mode+':arity:'+args.length,value:[e.name,e.errorID,effects.length]});}}
 }
 effects=[];fn=Reader.rectangle(effects);for(const value of [new Rectangle(1,2,3,4),new Rectangle(-2,-3,1,1),null])invoke(fn,[value]);rows.push({id:'capture-union',value:effects});
 const a=Reader.display([]),b=Reader.display([]);rows.push({id:'closures',value:[a===b,as3GetProperty(a,'length'),as3GetProperty(b,'length')]});rows.push({id:'conversions',value:conversions});
 for(const [mode,value]of [['display',sprite],['rectangle',rect]] as any)for(const [name,forged]of [['prototype',Object.create(Object.getPrototypeOf(value))],['proxy',new Proxy(value,{})],['copy',{...value}]]){effects=[];fn=Reader[mode](effects);let passed=false;try{invoke(fn,[forged]);}catch(e){passed=e.errorID===1034&&effects.length===0;}checks.push({name:mode+':'+name,passed});}
 session.retire();return {rows,checks};
}
