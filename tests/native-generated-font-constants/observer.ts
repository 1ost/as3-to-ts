import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {run as native} from '@FONT_OBSERVER@';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('fonts',domain);
 const subject=as3ConstructClass(domain.getDefinition('fontcases.FontUse'),[]);
 const call=(name,args)=>as3CallValue(get(subject,name),()=>args);
 const rows=[{id:'all',value:call('all',[])}];
 for(let i=0;i<4;i++)rows.push({id:'select-'+i,value:call('select',[Boolean(i&1),Boolean(i&2)])});
 const engine=native();return {rows:[...rows,...engine.rows],guards:engine.guards};
}
