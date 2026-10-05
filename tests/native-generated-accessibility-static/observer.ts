import '@ENGINE@/tests/nativeCanonicalSpriteClass/init-imports';
import {Laya} from '@ENGINE@/src/layaAir/Laya';
import {Accessibility,AccessibilityDeclaration} from '@ACCESSIBILITY@';
import {Accessibility as NativeAccessibility} from '@ENGINE@/src/layaAir/flash/accessibility/Accessibility';
import {Sprite} from '@ENGINE@/src/layaAir/flash/utils/AS3CanonicalSpriteProperties';
import {ApplicationDomain} from '@ENGINE@/src/layaAir/flash/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@ENGINE@/src/layaAir/flash/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set} from '@ENGINE@/src/layaAir/flash/utils/AS3Property';
import {as3CallValue} from '@ENGINE@/src/layaAir/flash/utils/AS3Invocation';
import {as3AsClass} from '@ENGINE@/src/layaAir/flash/utils/AS3Class';
import {as3Is,as3As} from '@ENGINE@/src/layaAir/flash/utils/AS3Type';
import {as3DescribeTypeXML} from '@ENGINE@/src/layaAir/flash/utils/AS3ReflectionQuery';
import {nativeSourceClassModule as artifact} from './factory.js';

export async function run(){
 await Laya.init(160,100);
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>artifact,maxModules:1});await session.load('accessibility',domain);
 const sprite=new Sprite();sprite.name='accessibility-probe';
 const Reader=domain.getDefinition('accessstatic.Reader'),rows:any[]=as3CallValue(get(Reader,'run'),()=>[sprite]) as any[];
 const row=(id:string,value:unknown)=>rows.push({id,value}),invoke=(fn:Function,args:any[],receiver:any=null)=>{try{return ['return',fn.apply(receiver,args)===undefined];}catch(e){return ['error',get(e,'name'),get(e,'errorID')];}};
 const send=Accessibility.sendEvent,update=Accessibility.updateProperties;
 row('method-identity',[send===Accessibility.sendEvent,update===Accessibility.updateProperties,send.length,update.length]);
 row('detached-update',invoke(update,[],{}));row('detached-send',invoke(send,[sprite,1,32773],{}));
 row('send-null',invoke(send,[null,0,0]));row('send-undefined',invoke(send,[undefined,0,0]));row('send-object',invoke(send,[{},0,0]));row('send-class',invoke(send,[Sprite,0,0]));
 row('send-zero-args',invoke(send,[]));row('send-two-args',invoke(send,[sprite,1]));row('send-five-args',invoke(send,[sprite,1,2,false,0]));row('update-extra',invoke(update,[1]));row('send-numeric-coercion',invoke(send,[sprite,-1,4294967297,'yes']));
 const order:string[]=[],child={valueOf:()=>{order.push('child');return -1;}},event={valueOf:()=>{order.push('event');return 32773;}};
 row('send-coercion',invoke(send,[sprite,child,event,false]));row('coercion-order',order.slice());order.length=0;
 row('invalid-source-order',invoke(send,[{},child,event,false]));row('invalid-source-coercions',order.slice());order.length=0;
 row('null-source-order',invoke(send,[null,child,event,false]));row('null-source-coercions',order.slice());
 const signal={};let same=false;try{(send as Function).apply(null,[sprite,{valueOf:()=>{throw signal;}},event,false]);}catch(e){same=e===signal;}row('coercion-throw-identity',same);
 try{new (Accessibility as any)();row('construct','accepted');}catch(e){row('construct',[get(e,'name'),get(e,'errorID')]);}
 try{set(Accessibility,'active',true);row('write-active','accepted');}catch(e){row('write-active',[get(e,'name'),get(e,'errorID')]);}row('final-active',Accessibility.active);
 const checks=[{id:'native-identity',passed:Accessibility===NativeAccessibility},{id:'source-class',passed:as3AsClass(Accessibility)===Accessibility},
  {id:'class-not-instance',passed:!as3Is(Accessibility,AccessibilityDeclaration)},{id:'prototype-not-instance',passed:!as3Is(Accessibility.prototype,AccessibilityDeclaration)},
  {id:'forgery-not-instance',passed:!as3Is(Object.create(Accessibility.prototype),AccessibilityDeclaration)},{id:'forgery-as-null',passed:as3As(Object.create(Accessibility.prototype),AccessibilityDeclaration)===null},
  {id:'undefined-as-null',passed:as3As(undefined,AccessibilityDeclaration)===null},{id:'forged-display-rejected',passed:invoke(send,[Object.create(Sprite.prototype),0,0])[2]===1034}];
 return {rows,checks,reflection:as3DescribeTypeXML(Accessibility).toXMLString()};
}
