import '@ENGINE@/tests/nativeCanonicalSpriteClass/init-imports';
import {Laya} from '@ENGINE@/src/layaAir/Laya';
import {Sprite} from '@FLASH@/display/Sprite';
import {MouseEvent,isFlashMouseEvent} from '@FLASH@/events/MouseEvent';
import {Event,isFlashEvent} from '@FLASH@/events/Event';
import {Sprite as LayaSprite} from '@ENGINE@/src/layaAir/laya/display/Sprite';

import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {as3GetProperty} from '@FLASH@/utils/AS3Property';
export async function run(module:NativeSourceClassModule){
    const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
    const domain=await session.load('mouse',new ApplicationDomain(ApplicationDomain.currentDomain));
    const Factory=domain.getDefinition('mousecases.MouseFactory') as any;
    await Laya.init(320,240);
    const n=(v:number)=>Number.isNaN(v)?'NaN':v===Infinity?'Infinity':v===-Infinity?'-Infinity':v;
    const values=(e:MouseEvent)=>[e.type,e.bubbles,e.cancelable,n(e.localX),n(e.localY),e.ctrlKey,e.altKey,e.shiftKey,e.buttonDown,e.delta,e.commandKey,e.controlKey,e.clickCount,n(e.stageX),n(e.stageY),e.eventPhase,e.isDefaultPrevented()];
    const rows:any[]=[];let e:MouseEvent=Factory.defaults();rows.push({id:'defaults',value:values(e)});
    rows.push({id:'defaults-targets',value:[e.target===null,e.currentTarget===null,e.relatedObject===null,e instanceof MouseEvent,e instanceof Event]});
    const parent=new Sprite(),related=new Sprite(),dispatcher=new Sprite();parent.x=10;parent.y=20;related.x=3;related.y=4;parent.addChild(related);
    e=Factory.make(related);
    rows.push({id:'related',value:values(e)});rows.push({id:'related-targets',value:[e.target===related,e.currentTarget===related,e.relatedObject===related]});
    const clone=e.clone();if(!isFlashMouseEvent(clone)||!isFlashEvent(clone)||Object.getPrototypeOf(clone)!==MouseEvent.prototype)throw Error('Clone native identity');
    rows.push({id:'clone',value:values(clone)});rows.push({id:'clone-identity',value:[clone!==e,'flash.events::MouseEvent',clone.relatedObject===related,clone.target===null,clone.currentTarget===null]});
    const trace:any[]=[];dispatcher.addEventListener('probe',(event:MouseEvent)=>{trace.push([event.target===related,event.currentTarget===related,event.relatedObject===related,event.eventPhase,n(event.stageX),n(event.stageY)]);event.preventDefault();});
    rows.push({id:'dispatch-result',value:dispatcher.dispatchEvent(e)});rows.push({id:'dispatch',value:trace});rows.push({id:'after-dispatch',value:values(e)});
    e=Factory.entry();rows.push({id:'pre-super',value:as3GetProperty(e,'before')});rows.push({id:'post-super',value:values(e)});
    for(const sample of [Infinity,-Infinity,NaN,-1,1.9,4294967297,null,undefined,'12'] as any[]){try{e=new MouseEvent('number',true,false,sample,sample,null,false,false,false,false,sample,false,false,sample);rows.push({id:'numeric:'+String(sample),value:values(e)});}catch(error:any){rows.push({id:'numeric:'+String(sample),value:[error.name,error.errorID]});}}
    const snapshot=(e:MouseEvent)=>({type:e.type,bubbles:e.bubbles,cancelable:e.cancelable,localX:n(e.localX),localY:n(e.localY),relatedObjectIsNull:e.relatedObject===null,ctrlKey:e.ctrlKey,altKey:e.altKey,shiftKey:e.shiftKey,buttonDown:e.buttonDown,delta:e.delta,commandKey:e.commandKey,controlKey:e.controlKey,clickCount:e.clickCount,stageX:n(e.stageX),stageY:n(e.stageY)});
    const cases:[string,MouseEvent][]=[
        ['arity-1-defaults',new MouseEvent('arity-1')],
        ['arity-3-bubble-cancel',new MouseEvent('arity-3',true,false)],
        ['arity-5-coordinates',new MouseEvent('arity-5',false,true,12.5,-3.25)],
        ['arity-10-modifiers',new MouseEvent('arity-10',true,true,4.5,5.5,null,true,true,true,true)],
        ['arity-14-sdk-tail',new MouseEvent('arity-14',false,true,1.25,2.5,null,true,false,true,false,-7,true,true,4)]
    ];
    const constructors=cases.map(([id,event])=>({id,result:{event:snapshot(event),clone:snapshot(event.clone()),cloneIsDistinct:event.clone()!==event}}));
    // Native-input regression only, not a claim of original AIR input parity.
    const nativeTarget=new LayaSprite();nativeTarget.pos(10,20);
    const projected=MouseEvent._fromNative('mouseMove',{touchPos:{x:31,y:47},nativeEvent:{ctrlKey:true,altKey:false,shiftKey:true,buttons:1},button:0,delta:0,isDblClick:false} as any,nativeTarget);
    const projection=[projected.localX,projected.localY,projected.stageX,projected.stageY,projected.ctrlKey,projected.buttonDown];
    if(JSON.stringify(projection)!==JSON.stringify([21,27,31,47,true,true]))throw Error('Native stage/local projection changed');
    nativeTarget.destroy();
    const guards:string[]=[];
    const reject=(name:string,fn:()=>unknown)=>{try{fn();}catch{guards.push(name);return;}throw Error('Guard accepted '+name);};
    reject('private-helper-export',()=>domain.getDefinition('PsuedoMouseEvent'));
    reject('private-entry-export',()=>domain.getDefinition('EntryMouseEvent'));
    reject('related-type',()=>Factory.make({}));
    const sample=Factory.make(related),prototype=Object.getPrototypeOf(sample);
    for(const name of ['target','currentTarget']) {
        const getter=Object.getOwnPropertyDescriptor(prototype,name)!.get!;
        reject('forged-'+name,()=>getter.call(Object.create(prototype)));
    }
    const sibling=await session.load('sibling',new ApplicationDomain(ApplicationDomain.currentDomain));
    const Other=sibling.getDefinition('mousecases.MouseFactory') as any;
    if(Other===Factory||Object.getPrototypeOf(Other.defaults())===Object.getPrototypeOf(Factory.defaults()))throw Error('Private identity leaked between domains');
    session.retire();if(sample.target!==related||sample.currentTarget!==related)throw Error('Retired source instance changed');
    return {rows,constructors,projection,guards};
}
