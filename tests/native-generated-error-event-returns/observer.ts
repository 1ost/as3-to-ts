import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ErrorEvent} from '@FLASH@/utils/AS3CanonicalErrorEventReference';
import {IOErrorEvent} from '@FLASH@/events/IOErrorEvent';
import {SecurityErrorEvent} from '@FLASH@/events/SecurityErrorEvent';
import {Event} from '@FLASH@/events/Event';
import {TextEvent} from '@FLASH@/events/TextEvent';
export async function run(module){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1}),domain=await session.load('returns',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Reader=domain.getDefinition('returns.Reader') as any,r=new Reader(),rows=[],checks=[],event=new ErrorEvent('error');let conversions=0;
 const fake={toString(){conversions++;return 'error';},valueOf(){conversions++;return event;}};
 const samples=[event,new IOErrorEvent('io'),new SecurityErrorEvent('security'),null,undefined,new Event('event'),new TextEvent('text'),{},fake,3,'text',true,ErrorEvent,ErrorEvent.prototype];
 for(let i=0;i<samples.length;i++)for(const mode of ['echo','get']){r.effects=[];r.raw=samples[i];try{const result=mode==='echo'?r.echo(samples[i]):r.result;rows.push({id:mode+':'+i,value:[result===samples[i],result===null,r.effects.slice()]});}catch(e){rows.push({id:mode+':'+i,value:[e.name,e.errorID,r.effects.slice()]});}}
 rows.push({id:'default',value:r.saved===null});r.effects=[];r.saved=event;rows.push({id:'setter',value:[r.saved===event,r.effects.slice()]});
 r.effects=[];try{r.saved=fake;rows.push({id:'bad-setter',value:'accepted'});}catch(e){rows.push({id:'bad-setter',value:[e.name,e.errorID,r.saved===event,r.effects.slice()]});}
 const values=[event,fake];for(const method of ['finalValue','overrideValue','guardedValue'])for(let a=0;a<2;a++)for(let b=0;b<2;b++){r.effects=[];try{const result=r[method](values[a],values[b]);rows.push({id:method+':'+a+':'+b,value:[result===event,r.effects.slice()]});}catch(e){rows.push({id:method+':'+a+':'+b,value:[e.name,e.errorID,r.effects.slice()]});}}
 rows.push({id:'conversions',value:conversions});
 for(const [name,value]of [['forged',Object.create(ErrorEvent.prototype)],['proxy',new Proxy(event,{})],['copied',{...event}]]){let passed=false;try{r.echo(value);}catch(e){passed=e.errorID===1034;}checks.push({name,passed});}
 session.retire();return {rows,checks};
}
