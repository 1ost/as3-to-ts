import {as3GetProperty} from '@FLASH@/utils/AS3Property';
import {ILaya} from '@FLASH@/../ILaya';
import {LayaGL} from '@FLASH@/../laya/layagl/LayaGL';
import {NoRender2DProcess} from '@FLASH@/../laya/RenderDriver/NoRenderDriver/2DRenderPass/NoRender2DProcess';
import {NoRenderDeviceFactory} from '@FLASH@/../laya/RenderDriver/NoRenderDriver/DriverDevice/NoRenderDeviceFactory';
import '@FLASH@/utils/AS3CanonicalSpriteProperties';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {Sprite} from '@FLASH@/display/Sprite';
import {Event} from '@FLASH@/events/Event';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
export async function run(module){
 LayaGL.render2DRenderPassFactory=new NoRender2DProcess();LayaGL.renderDeviceFactory=new NoRenderDeviceFactory();
 ILaya.stage={_graphicUpdateList:new Set(),_tranMatrixUpdateList:new Set()} as any;
 ILaya.timer={callLater:()=>undefined} as any;ILaya.systemTimer={callLater:()=>undefined,runCallLater:()=>undefined} as any;
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1}),domain=await session.load('listeners',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Caller=domain.getDefinition('listeners.Caller') as any,c=new Caller(),target=new Sprite(),other=new Sprite(),rows=[],checks=[];let seen=[];
 const listener=(e:Event)=>{seen.push([e.type,e.target===target]);};
 c.own();rows.push({id:'own',value:c.calls.slice()});
 c.calls=[];c.attach(target,listener);rows.push({id:'attach',value:c.calls.slice()});target.dispatchEvent(new Event('ping'));rows.push({id:'dispatch',value:seen.slice()});
 c.attach(target,listener);seen=[];target.dispatchEvent(new Event('ping'));rows.push({id:'duplicate',value:seen.slice()});
 c.calls=[];c.detach(target,listener);seen=[];target.dispatchEvent(new Event('ping'));rows.push({id:'detach',value:[c.calls.slice(),seen.slice()]});
 const bound=c.read(target);rows.push({id:'closure',value:[bound===c.read(target),bound===c.read(other),as3GetProperty(bound,"length")]});as3CallValue(bound,()=>['ping',listener]);seen=[];target.dispatchEvent(new Event('ping'));rows.push({id:'bound-call',value:seen.slice()});c.detach(target,listener);
 c.store(target);c.calls=[];c.chained(listener);rows.push({id:'chained',value:c.calls.slice()});c.detach(target,listener);
 for(const method of ['attach','detach','read']){c.calls=[];try{if(method==='read')c.read(null);else c[method](null,listener);rows.push({id:'null:'+method,value:'accepted'});}catch(error){rows.push({id:'null:'+method,value:[error.name,error.errorID,c.calls.slice()]});}}
 c.calls=[];c.throwArgument=true;try{c.attach(null,listener);rows.push({id:'argument-throw',value:'accepted'});}catch(thrown){rows.push({id:'argument-throw',value:[thrown,c.calls.slice()]});}c.throwArgument=false;
 c.calls=[];c.throwReceiver=true;try{c.chained(listener);rows.push({id:'receiver-throw',value:'accepted'});}catch(thrown){rows.push({id:'receiver-throw',value:[thrown,c.calls.slice()]});}
 for(const [name,value]of [['forged',Object.create(Sprite.prototype)],['proxy',new Proxy(target,{})]]){let passed=false;try{c.attach(value,listener);}catch(error){passed=error.errorID===1034;}checks.push({name,passed});}
 session.retire();return {rows,checks};
}
