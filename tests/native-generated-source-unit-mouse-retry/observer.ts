import '@ENGINE@/tests/nativeDisplayProjection/entry';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3CallValue,getAS3FunctionIntrinsic} from '@FLASH@/utils/AS3Invocation';
import {getQualifiedClassName} from '@FLASH@/utils/getQualifiedClassName';
import {MouseEventDeclaration} from '@FLASH@/utils/AS3CanonicalMouseEventType';
import {as3Is} from '@FLASH@/utils/AS3Type';
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
 const owner=exercise('owner','OwnerRetry','failOwner','owner','owner-helper');set(Trace,'events',[]);
 const helper=exercise('helper','HelperRetry','failHelper','helper-owner','helper');
 row('escaped-helper-instances',select('helper').map(record=>{try{return call(get(get(record,'values'),0),'read')===get(record,'values');}catch(e){return fail(e);}}));
 row('final-helper-bindings',[owner===null?'no-return':get(owner,2)===null,helper===null?'no-return':get(helper,1)===null]);
 set(Trace,'events',[]);set(Trace,'failOwner',true);
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
 for(const label of ['helper','late-helper']){
  const records=select(label);
  row(label+'-native-state',records.map(record=>{const v=get(get(record,'values'),0);return [as3Is(v,MouseEventDeclaration),get(v,'type'),get(v,'localX'),get(v,'localY'),get(v,'target')===null,get(v,'currentTarget')===null,get(v,'relatedObject')===null];}));
  records.forEach((record,index)=>set(get(get(record,'values'),0),'localX',index+17));
  row(label+'-native-independent',records.map(record=>{const v=get(get(record,'values'),0);return [get(v,'localX'),call(v,'read')===get(record,'values')];}));
 }
 const sibling=new ApplicationDomain(ApplicationDomain.currentDomain),siblingSession=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await siblingSession.load('sibling',sibling);
 const child=new ApplicationDomain(domain),childSession=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await childSession.load('child',child);
 const domainChecks=[sibling.getDefinition('unitretry.Trace')!==Trace,get(get(sibling.getDefinition('unitretry.Trace'),'records'),'length')===0,child.getDefinition('unitretry.Trace')===Trace,...['OwnerRetry','HelperRetry','LateOwnerRetry','LateHelperRetry'].map(name=>child.getDefinition('unitretry.'+name)===domain.getDefinition('unitretry.'+name))];
 if(domainChecks.some(value=>!value))throw Error('Source unit domain isolation/inheritance mismatch');
 return {rows,domainChecks};
}
