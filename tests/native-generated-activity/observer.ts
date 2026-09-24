import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import * as property from '@FLASH@/utils/AS3Property';
import * as invocation from '@FLASH@/utils/AS3Invocation';
import * as classes from '@FLASH@/utils/AS3Class';
import * as errors from '@FLASH@/errors/AS3SourceError';
import {getAS3FunctionIntrinsic} from '@FLASH@/utils/AS3Invocation';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 await session.load('activity',domain);
 const api={...property,...invocation,...classes,...errors,getAS3FunctionIntrinsic};
 const dataName='cn.kyiax.game.data.cfg.CfgActivityStep',proxyClassName='cn.kyiax.game.modules.common.model.proxy.data.CfgActivityStepProxy';
 // Observation adapter for ActivityStepProbe; all eight subjects are generated whole.
const get=api.as3GetProperty,set=api.as3SetProperty,rows=[],row=(id,value)=>rows.push({id,value});
const call=(receiver,name,...args)=>api.as3CallValue(get(receiver,name),()=>args);
const make=cls=>api.as3ConstructClass(cls,[]);
const RecordClass=domain.getDefinition(dataName),ProxyClass=domain.getDefinition(proxyClassName),GameConfig=domain.getDefinition('cn.kyiax.game.config.GameConfig'),StringUtil=domain.getDefinition('cn.kyiax.yare.util.StringUtil');
const observe=(id,fn)=>{try{row(id,fn());}catch(e){if(!api.as3IsSourceErrorInstance(e))throw e;row(id,['error',e.name,e.errorID]);}};
const r=make(RecordClass),desc=()=>call(r,'getActivityDesc');
row('defaults',[get(r,'recordId'),get(r,'type'),get(r,'desc'),get(r,'items')===null,get(r,'isReadValue')]);
observe('default-description',desc);set(r,'desc','raw {0}');observe('disabled',desc);
set(r,'isReadValue',true);set(r,'type',-1);observe('unknown-type',desc);
set(r,'items',[10,0,12]);set(r,'amounts',[2,3,4]);set(r,'fragments',[0,11,13]);set(r,'fragmentAmounts',[5,6,7]);set(r,'desc','rewards');
const types=['ACTIVITY_TYPE_OPERATION_MONEY_TREE','ACTIVITY_TYPE_CONSUMPTION_TOTAL','ACTIVITY_TYPE_OPERATION_CAPTAIN_TREASURE','ACTIVITY_TYPE_OPERATION_TAVERN','ACTIVITY_TYPE_OPERATION_PIRATES_FUND'].map(n=>get(GameConfig,n));
for(let i=0;i<types.length;i++){set(r,'type',types[i]);observe('append-branch-'+i,desc);}
set(r,'type',get(GameConfig,'ACTIVITY_TYPE_VIP_FEEDBACK'));set(r,'desc','{0}|{1}|{2}|{3}|{0}|{9}');observe('vip-substitution',desc);
set(r,'desc',null);observe('vip-null-description',desc);set(r,'type',types[0]);observe('append-null-description',desc);
set(r,'desc','empty');set(r,'items',[]);set(r,'fragments',null);set(r,'amounts',null);set(r,'fragmentAmounts',null);observe('empty-items',desc);
set(r,'type',get(GameConfig,'ACTIVITY_TYPE_VIP_FEEDBACK'));observe('vip-empty-items',desc);set(r,'items',null);observe('null-items',desc);
set(r,'items',[1]);set(r,'type',types[0]);observe('null-fragments',desc);set(r,'fragments',[]);set(r,'amounts',[]);set(r,'fragmentAmounts',[]);observe('short-arrays',desc);
set(r,'items',[-1,0]);set(r,'fragments',[-2,0]);set(r,'amounts',[3,4]);set(r,'fragmentAmounts',[5,6]);observe('negative-ids',desc);
const p=make(ProxyClass);set(r,'recordId',41);call(p,'parse',[r]);row('proxy-identity',[call(p,'getProxyName'),call(p,'getById',41)===r,call(p,'getAll').length]);
observe('proxy-description',()=>call(call(p,'getById',41),'getActivityDesc'));
const other=make(RecordClass);set(other,'desc','other');const callback=get(r,'getActivityDesc');observe('bound-description',()=>api.as3CallValue(api.getAS3FunctionIntrinsic(callback,'call'),()=>[other]));
observe('substitute-rest',()=>call(StringUtil,'substitute','{0}/{1}/{2}/{0}','A',2,null));
observe('substitute-no-arguments',()=>call(StringUtil,'substitute','{0}'));
observe('substitute-dollar-text',()=>call(StringUtil,'substitute','{0}|{1}',['$&','$$']));
return {rows};

}
