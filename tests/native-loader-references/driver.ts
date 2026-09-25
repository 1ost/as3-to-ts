import { Laya } from "ENGINE/src/layaAir/Laya";
import "ENGINE/src/layaAir/laya/ModuleDef";
import "ENGINE/src/layaAir/laya/platform/BrowserAdapter";
import "ENGINE/src/layaAir/laya/platform/FileSystemAdapter";
import "ENGINE/src/layaAir/laya/platform/FontAdapter";
import "ENGINE/src/layaAir/laya/platform/MediaAdapter";
import "ENGINE/src/layaAir/laya/platform/StorageAdapter";
import "ENGINE/src/layaAir/laya/platform/TextInputAdapter";
import "ENGINE/src/layaAir/laya/device/WebDeviceAdapter";
import "ENGINE/src/layaAir/laya/RenderDriver/RenderModuleData/WebModuleData/WebUnitRenderModuleDataFactory";
import "ENGINE/src/layaAir/laya/RenderDriver/WebGLDriver/RenderDevice/WebGLRenderDeviceFactory";
import "ENGINE/src/layaAir/laya/RenderDriver/WebGLDriver/2DRenderPass/WebGLRender2DProcess";
import {Loader,Bitmap,URLLoader,Sound} from 'ENGINE/src/layaAir/flash/utils/AS3CanonicalLoaderReferences';
import {nativeSourceClassModule} from './module.js';
import {createNativeSourceClassLoadingSession} from 'ENGINE/src/layaAir/flash/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from 'ENGINE/src/layaAir/flash/system/ApplicationDomain';
class LoaderChild extends Loader {} class BitmapChild extends Bitmap {}
class URLLoaderChild extends URLLoader {} class SoundChild extends Sound {}
(globalThis as any).done=(async()=>{
 await Laya.init(160,100);
 const session=createNativeSourceClassLoadingSession({resolve:()=>nativeSourceClassModule,maxModules:2});
 const domain=await session.load('holder',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Holder:any=domain.getDefinition('LoaderHolder');const holder=new Holder();
 const rows:any[]=[];let guards=0;const check=(value:boolean,label:string)=>{if(!value)throw Error(label);guards++;};
 const cases:any[]=[['Loader',Loader,new Loader(),new LoaderChild()],['Bitmap',Bitmap,new Bitmap(),new BitmapChild()],['URLLoader',URLLoader,new URLLoader(),new URLLoaderChild()],['Sound',Sound,new Sound(),new SoundChild()]];
 for(const [name,Type,first,sub] of cases){
 rows.push({id:name+'-default',value:[holder['value'+name]===null,holder['view'+name]===null]});
 const values=[first,sub,null,undefined,{},[],1,'x',Type];
 values.forEach((input,i)=>{
 rows.push({id:name+'-inspect-'+i,value:holder['inspect'+name](input)});
 holder['value'+name]=first;let failure=null,result:unknown=undefined;
 try{result=holder['accept'+name](input);}catch(e){failure=[(e as any).name,(e as any).errorID];}
 rows.push({id:name+'-accept-'+i,error:failure,value:[holder['view'+name]===first,holder['view'+name]===input,holder['view'+name]===null,result===input,result===undefined]});
 });
 let calls=0;rows.push({id:name+'-once',value:[holder['effect'+name](()=>{calls++;return first;})===first,calls]});
 const forged=Object.create(Type.prototype);check(JSON.stringify(holder['inspect'+name](forged))==='[false,true,false]','prototype forgery');
 holder['value'+name]=first;let error:any;try{holder['accept'+name](forged);}catch(e){error=e;}
 check(error?.errorID===1034&&holder['value'+name]===first,'forged typed parameter atomicity');
 let traps=0;const proxy=new Proxy(first,{get(){traps++;throw Error('get');},getPrototypeOf(){traps++;throw Error('proto');}});
 check(JSON.stringify(holder['inspect'+name](proxy))==='[false,true,false]'&&traps===0,'proxy identity');
 error=null;try{holder['value'+name]=forged;}catch(e){error=e;}
 check(error?.errorID===1034&&holder['view'+name]===first,'forged typed slot atomicity');
 }
 const other=await session.load('holder',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Other:any=other.getDefinition('LoaderHolder');check(Other!==Holder,'domain class isolation');
 check(new Other().acceptBitmap(cases[1][2])===cases[1][2],'canonical provider across domains');
 session.retire();(globalThis as any).result={rows,guards};
})();
