import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {getQualifiedClassName} from '@FLASH@/utils/getQualifiedClassName';
import {as3CreateObjectLiteral} from '@FLASH@/utils/AS3Class';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('functions',domain);
 const Functions=domain.getDefinition('returncases.Functions'),invoke=(name,args=[])=>as3CallValue(get(Functions,name),()=>args);
 const rows=[],row=(id,value)=>rows.push({id,value}),pair=invoke('pair'),other=invoke('pair'),object=as3CreateObjectLiteral([['marker',1]]);
 let direct=invoke('invoke',[pair,object,17]);row('call-explicit',[get(direct,0)===object,get(direct,1)]);
 const global=invoke('invoke',[pair,null,23]);row('call-null',[getQualifiedClassName(get(global,0)),get(global,1),get(global,0)===get(invoke('invoke',[pair,undefined,0]),0)]);
 direct=invoke('invokeApply',[pair,object,[29]]);row('apply-explicit',[get(direct,0)===object,get(direct,1)]);
 direct=invoke('invokeApply',[pair,null,[31]]);row('apply-null',[get(direct,0)===get(global,0),get(direct,1)]);
 direct=invoke('replacement',[pair,other,object]);row('replacement',[get(direct,0)===object,get(direct,1)===other]);
 let effects=[];direct=invoke('effect',[pair,effects]);row('effects',[get(direct,0)===get(global,0),get(direct,1),effects.join(',')]);
 effects=[];try{invoke('effect',[null,effects]);row('null-after-argument','accepted');}catch(e){row('null-after-argument',[e.errorID,effects.join(',')]);}
 try{invoke('invokeApply',[pair,object,17]);row('apply-non-array','accepted');}catch(e){row('apply-non-array',e.errorID);}
 return {rows};
}
