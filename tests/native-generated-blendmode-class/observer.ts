import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {run as native} from '@BLEND_OBSERVER@';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('blendmode-class',domain);
 const subject=as3ConstructClass(domain.getDefinition('blendcases.BlendUse'),[]);
 const call=(name,args)=>as3CallValue(get(subject,name),()=>args);
 const rows=[{id:'all',value:call('all',[])}];
 for(let i=0;i<4;i++)rows.push({id:'match-'+i,value:call('matches',[i&1?'add':'normal',i&2?0.5:1])});
 const engine=native();return {rows:[...rows,...engine.rows],guards:engine.guards};
}
