import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3Is} from '@FLASH@/utils/AS3Type';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3CallValue,getAS3FunctionIntrinsic} from '@FLASH@/utils/AS3Invocation';
import {getQualifiedClassName} from '@FLASH@/utils/getQualifiedClassName';
import {QName} from '@FLASH@/utils/QName';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('retry',domain);
 const Trace=domain.getDefinition('unitretry.Trace'),rows=[],row=(id,value)=>rows.push({id,value});
 const array=value=>Array.from({length:get(value,'length')},(_,i)=>get(value,i));
 const select=label=>array(get(Trace,'records')).filter(record=>get(record,'label')===label);
 const events=()=>array(get(Trace,'events'));
 const call=(object,name,...args)=>as3CallValue(get(object,name),()=>args);
 const callNull=fn=>as3CallValue(getAS3FunctionIntrinsic(fn,'call'),()=>[null]);
 const fail=error=>error===get(Trace,'failure')?[true]:[false,get(error,'name'),get(error,'errorID')];
 const binding=(record,name)=>{try{const value=get(get(record,'global'),new QName('unitretry',name));return [value===null,value===get(record,'klass'),value===undefined];}catch(e){return [get(e,'name'),get(e,'errorID')];}};
 const identities=label=>{const records=select(label);return [records.length,...records.slice(1).map(record=>['klass','global','fn','values'].map(name=>get(records[0],name)===get(record,name)))];};
 const contexts=(label,name)=>select(label).map(record=>[callNull(get(record,'fn'))===get(record,'global'),getQualifiedClassName(get(record,'global')),binding(record,name),get(get(record,'values'),'length'),get(get(record,'values'),0)===null]);
 row('before',events());
 const exercise=(prefix,name,flag,owner,helper)=>{
  let result=null;
  for(let i=0;i<4;i++){
   if(i===2)set(Trace,flag,false);
   try{result=call(domain.getDefinition('unitretry.'+name),'read');const values=array(result);row(prefix+'-attempt-'+i,['returned',get(values[0],'length'),...(flag==='failOwner'?[get(values[1],'length')]:[]),values[values.length-1]===null]);}
   catch(error){row(prefix+'-attempt-'+i,fail(error));}
   row(prefix+'-events-'+i,events());
  }
  row(owner+'-identities',identities(owner));row(helper+'-identities',identities(helper));
  row(owner+'-contexts',contexts(owner,name));row(helper+'-contexts',contexts(helper,name));return result;
 };
 for(let attempt=0;attempt<2;attempt++){
  try{call(domain.getDefinition('unitretry.OwnerRetry'),'read');row('base-failure-'+attempt,['returned']);}
  catch(error){row('base-failure-'+attempt,[fail(error),events(),select('owner').length,select('owner-helper').length]);}
 }
 set(Trace,'failBase',false);set(Trace,'events',[]);
 const owner=exercise('owner','OwnerRetry','failOwner','owner','owner-helper');set(Trace,'events',[]);
 const helper=exercise('helper','HelperRetry','failHelper','helper-owner','helper');
 row('escaped-helper-instances',select('helper').map(record=>{try{return call(get(get(record,'values'),0),'read')===get(record,'values');}catch(e){return fail(e);}}));
 row('final-helper-bindings',[owner===null?'no-return':get(owner,2)===null,helper===null?'no-return':get(helper,1)===null]);
 set(Trace,'events',[]);set(Trace,'failOwner',true);
 for(let attempt=0;attempt<2;attempt++){
  try{call(domain.getDefinition('unitretry.LateOwnerRetry'),'read');row('middle-failure-'+attempt,['returned']);}
  catch(error){row('middle-failure-'+attempt,[fail(error),events(),select('late-owner').length,select('late-owner-helper').length]);}
 }
 set(Trace,'failMiddle',false);set(Trace,'events',[]);
 const lateOwner=exercise('late-owner','LateOwnerRetry','failOwner','late-owner','late-owner-helper');
 set(Trace,'events',[]);set(Trace,'failHelper',true);
 const lateHelper=exercise('late-helper','LateHelperRetry','failHelper','late-helper-owner','late-helper');
 const lateOwners=select('late-helper-owner'),lateHelpers=select('late-helper'),finalHelper=lateHelpers[lateHelpers.length-1];
 row('late-helper-shared-globals',lateOwners.map((record,index)=>get(record,'global')===get(lateHelpers[index],'global')));
 row('late-helper-escaped-state',lateHelpers.map(record=>[call(get(get(record,'values'),0),'read')===get(record,'values'),call(get(get(record,'values'),0),'read')===get(finalHelper,'values')]));
 row('late-file-private-isolation',[get(lateOwner,2)===get(lateHelper,1),get(lateOwner,2)===get(select('late-owner-helper')[0],'klass'),get(lateHelper,1)===get(finalHelper,'klass')]);
 for(const [label,helperLabel]of [['owner','owner-helper'],['helper-owner','helper'],['late-owner','late-owner-helper'],['late-helper-owner','late-helper']]){
  const helpers=select(helperLabel),finalClass=get(helpers[helpers.length-1],'klass');
  row(label+'-escaped-class-reads',select(label).map(record=>{try{const state=array(call(get(record,'klass'),'read'));return [state[0]===get(record,'values'),state[state.length-1]===null,state[state.length-1]===finalClass];}catch(e){return fail(e);}}));
 }
 const Base=domain.getDefinition('unitretry.Base'),Middle=domain.getDefinition('unitretry.Middle'),IRoot=domain.getDefinition('unitretry.IRoot'),ILeaf=domain.getDefinition('unitretry.ILeaf');
 for(const [name,label]of [['OwnerRetry','owner'],['HelperRetry','helper-owner'],['LateOwnerRetry','late-owner'],['LateHelperRetry','late-helper-owner']]){
  const generations=select(label),latest=get(generations[generations.length-1],'klass');
  const existing=array(get(Trace,'instances')).filter(r=>get(r,'label')===name).map(r=>get(r,'instance'));
  row(name+'-inheritance',generations.map((record,g)=>{
   const k=get(record,'klass'),instance=as3ConstructClass(k,[31]),old=existing[g];
   return [as3Is(instance,Base),as3Is(instance,Middle),as3Is(instance,IRoot),as3Is(instance,ILeaf),as3Is(instance,k),as3Is(instance,latest),call(instance,'readBase'),call(instance,'marker'),as3Is(old,k),as3Is(old,latest),call(old,'readBase'),call(old,'marker'),old===instance];
  }));
 }
 for(const label of ['base','middle']){
  const parents=select(label),last=get(parents[parents.length-1],'klass');
  row(label+'-identities',identities(label));row(label+'-contexts',contexts(label,label==='base'?'Base':'Middle'));
  row(label+'-escaped-state',parents.map(record=>{const instance=get(get(record,'values'),0);return [call(get(record,'klass'),'readParent')===get(record,'values'),call(instance,'readBase'),as3Is(instance,get(record,'klass')),as3Is(instance,last)];}));
  row(label+'-retained',[parents.length,last===(label==='base'?Base:Middle),call(last,'readParent')===get(parents[parents.length-1],'values'),get(parents[0],'values')===get(parents[parents.length-1],'values')]);
 }
 const sibling=new ApplicationDomain(ApplicationDomain.currentDomain),siblingSession=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await siblingSession.load('sibling',sibling);
 const child=new ApplicationDomain(domain),childSession=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await childSession.load('child',child);
 set(sibling.getDefinition('unitretry.Trace'),'failBase',false);set(sibling.getDefinition('unitretry.Trace'),'failMiddle',false);
 const domainChecks=[...['Base','Middle','IRoot','ILeaf'].flatMap(n=>[child.getDefinition('unitretry.'+n)===domain.getDefinition('unitretry.'+n),sibling.getDefinition('unitretry.'+n)!==domain.getDefinition('unitretry.'+n)]),sibling.getDefinition('unitretry.Trace')!==Trace,get(get(sibling.getDefinition('unitretry.Trace'),'records'),'length')===2,child.getDefinition('unitretry.Trace')===Trace,...['OwnerRetry','HelperRetry','LateOwnerRetry','LateHelperRetry'].map(name=>child.getDefinition('unitretry.'+name)===domain.getDefinition('unitretry.'+name))];
 if(domainChecks.some(value=>!value))throw Error('Source unit domain isolation/inheritance mismatch: '+JSON.stringify(domainChecks));
 return {rows,domainChecks};
}
