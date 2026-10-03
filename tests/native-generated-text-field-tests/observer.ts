import { Laya } from "@ENGINE@/src/layaAir/Laya";
import "@ENGINE@/src/layaAir/laya/ModuleDef";
import "@ENGINE@/src/layaAir/laya/platform/BrowserAdapter";
import "@ENGINE@/src/layaAir/laya/platform/FileSystemAdapter";
import "@ENGINE@/src/layaAir/laya/platform/FontAdapter";
import "@ENGINE@/src/layaAir/laya/platform/MediaAdapter";
import "@ENGINE@/src/layaAir/laya/platform/StorageAdapter";
import "@ENGINE@/src/layaAir/laya/platform/TextInputAdapter";
import "@ENGINE@/src/layaAir/laya/device/WebDeviceAdapter";
import "@ENGINE@/src/layaAir/laya/RenderDriver/RenderModuleData/WebModuleData/WebUnitRenderModuleDataFactory";
import "@ENGINE@/src/layaAir/laya/RenderDriver/WebGLDriver/RenderDevice/WebGLRenderDeviceFactory";
import "@ENGINE@/src/layaAir/laya/RenderDriver/WebGLDriver/2DRenderPass/WebGLRender2DProcess";
import '@FLASH@/utils/AS3CanonicalTextFieldReference';
import {TextField} from '@FLASH@/text/TextField';
import {Rectangle} from '@FLASH@/geom/Rectangle';
import {as3Is} from '@FLASH@/utils/AS3Type';
import {as3GetProperty} from '@FLASH@/utils/AS3Property';
import {as3CallValue,getAS3FunctionIntrinsic} from '@FLASH@/utils/AS3Invocation';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
export async function run(module:NativeSourceClassModule){
 await Laya.init(160,120);
 const rows:any[]=[],checks:string[]=[],row=(id:string,value:unknown)=>rows.push({id,value});
 const check=(id:string,pass:boolean)=>{if(!pass)throw Error(id);checks.push(id);};
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const a=await session.load('a',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Subject=a.getDefinition('cases.TextFieldTests') as any,subject=new Subject(),value=new TextField();
 const values=[value,new Rectangle(),null,undefined,{},7,'text',TextField];
 for(let i=0;i<values.length;i++){const input=values[i],result=subject.nullable(input);row('is-'+i,subject.test(input));row('as-'+i,[result===input,result===null]);}
 let calls=0;row('once',[subject.once(()=>{calls++;return value;}),calls]);
 const sibling=await session.load('b',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Sibling=sibling.getDefinition('cases.TextFieldTests') as any;
 check('separate Classes',Sibling!==Subject);
 check('native reference shared',new Sibling().test(value)===true);
 const forged=Object.create(TextField.prototype);
 check('forged TextField test rejected',subject.test(forged)===false&&subject.nullable(forged)===null);
 const proxy=new Proxy(value,{});check('proxy TextField rejected',subject.test(proxy)===false&&subject.nullable(proxy)===null);
 session.retire();return {rows,checks};
}
