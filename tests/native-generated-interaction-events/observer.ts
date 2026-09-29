import '@ENGINE@/tests/nativeCanonicalSpriteClass/init-imports';
import {Laya} from '@ENGINE@/src/layaAir/Laya';
import {Event,MouseEvent,KeyboardEvent,FocusEvent,TextEvent,IMEEvent,ContextMenuEvent} from '@FLASH@/utils/AS3CanonicalInteractionEventReferences';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {as3GetProperty} from '@FLASH@/utils/AS3Property';
import {as3Is,as3As} from '@FLASH@/utils/AS3Type';
export async function run(module:NativeSourceClassModule){
 await Laya.init(320,240);
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const domain=await session.load('events',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Handler=domain.getDefinition('eventcases.InteractionHandler') as any;
 const contract=domain.getDefinition('flashx.textLayout.edit.IInteractionEventHandler') as any;
 const handler=Handler.make();
 const rows:any[]=[{id:'interface',value:[as3Is(handler,contract),as3As(handler,contract)===handler]}],guards:string[]=[];
 const samples=[null,undefined,{},new Event('event'),new MouseEvent('mouse'),new KeyboardEvent('keyDown'),new FocusEvent('focusIn'),new TextEvent('textInput'),new IMEEvent('imeComposition'),new ContextMenuEvent('menuSelect')];
 const members=['editHandler','keyDownHandler','keyUpHandler','keyFocusChangeHandler','textInputHandler','imeStartCompositionHandler','softKeyboardActivatingHandler','mouseDownHandler','mouseMoveHandler','mouseUpHandler','mouseDoubleClickHandler','mouseOverHandler','mouseOutHandler','focusInHandler','focusOutHandler','activateHandler','deactivateHandler','focusChangeHandler','menuSelectHandler','mouseWheelHandler'];
 for(const key of members){
  const call=as3GetProperty(handler,key) as Function;
  samples.forEach((value,index)=>{let result:any[];
   try{call(value);const last=as3GetProperty(handler,'last');result=[last===null,last===value];}
   catch(error:any){result=[error.name,error.errorID];}
   rows.push({id:key+':'+index,value:result});
  });
  try{call();throw Error('Missing argument accepted');}catch(error:any){if(error.errorID!==1063)throw error;guards.push(key);}
 }
 const other=await session.load('other',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Other=other.getDefinition('eventcases.InteractionHandler') as any;
 if(Other===Handler||as3Is(Other.make(),contract))throw Error('Interface identity crossed domains');
 session.retire();if(!as3Is(handler,contract))throw Error('Retirement changed existing interface identity');
 return {rows,guards};
}
