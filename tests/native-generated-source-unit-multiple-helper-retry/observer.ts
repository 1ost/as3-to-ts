import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3Is} from '@FLASH@/utils/AS3Type';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3CallValue,getAS3FunctionIntrinsic} from '@FLASH@/utils/AS3Invocation';
import {getQualifiedClassName} from '@FLASH@/utils/getQualifiedClassName';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('retry',domain);
 const Trace=domain.getDefinition('multiretry.Trace'),rows=[],checks=[];
 const array=value=>Array.from({length:get(value,'length')},(_,i)=>get(value,i));
 const selected=label=>array(get(Trace,'records')).filter(record=>get(record,'label')===label);
 const call=(object,name,...args)=>as3CallValue(get(object,name),()=>args);
 const callNull=fn=>as3CallValue(getAS3FunctionIntrinsic(fn,'call'),()=>[null]);
 const fail=e=>e===get(Trace,'failure')?[true]:[false,get(e,'name'),get(e,'errorID')];
 const names=['DerivedFail','OwnerFail','FirstFail','LastFail','Early'];
 for(const name of names){
  set(Trace,'events',[]);const count=name==='DerivedFail'?6:4;
  const failed=name==='OwnerFail'?'owner':name==='FirstFail'?'first':name==='LastFail'?'last':'derived';
  for(let i=0;i<count;i++){
   set(Trace,'failLabel',name==='DerivedFail'&&i<2?'base':i<count-2?name+'-'+failed:'');
   try{const state=array(call(domain.getDefinition('multiretry.'+name),'read'));rows.push({id:name+':attempt:'+i,value:['returned',get(state[0],'length'),state[1]===null,state[2]===null,state[3]===null]});}
   catch(e){rows.push({id:name+':attempt:'+i,value:fail(e)});}
   rows.push({id:name+':events:'+i,value:array(get(Trace,'events'))});
  }
  for(const suffix of ['owner','first','derived','last']){
   const records=selected(name+'-'+suffix),ids=[records.length],details=[],globals=[],latest=records.length?get(records[records.length-1],'klass'):null;
   for(let j=0;j<records.length;j++){
    const record=records[j];if(j>0)ids.push(...[[...['klass','global','fn','values'].map(p=>get(record,p)===get(records[0],p))]] as any);
    try{const k=get(record,'klass'),inst=as3ConstructClass(k,[31]),old=get(get(record,'values'),0);details.push([callNull(get(record,'fn'))===get(record,'global'),getQualifiedClassName(get(record,'global')),call(old,'number'),call(inst,'number'),as3Is(old,domain.getDefinition('multiretry.Base')),as3Is(inst,domain.getDefinition('multiretry.Middle')),as3Is(old,domain.getDefinition('multiretry.IMarker')),as3Is(old,k),as3Is(old,latest),as3Is(inst,latest),call(old,'readState')===get(record,'values'),call(inst,'readState')===get(record,'values')]);}catch(e){details.push(fail(e));}
    globals.push(selected(name+'-owner').map(owner=>get(owner,'global')===get(record,'global')));
   }
   rows.push({id:name+':'+suffix+':identities',value:ids});rows.push({id:name+':'+suffix+':state',value:details});rows.push({id:name+':'+suffix+':globals',value:globals});
  }
 }
 const parents=selected('base'),parentIds=[parents.length];for(let i=1;i<parents.length;i++)parentIds.push(...[[...['klass','global','fn','values'].map(p=>get(parents[i],p)===get(parents[0],p))]] as any);rows.push({id:'parent-identities',value:parentIds});
 const child=new ApplicationDomain(domain),cs=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await cs.load('child',child);
 const sibling=new ApplicationDomain(ApplicationDomain.currentDomain),ss=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await ss.load('sibling',sibling);
 checks.push({name:'sibling-isolated-trace',passed:sibling.getDefinition('multiretry.Trace')!==Trace&&get(get(sibling.getDefinition('multiretry.Trace'),'records'),'length')===0});
 for(const name of [...names,'Trace','Base','Middle','IMarker']){const q='multiretry.'+name;checks.push({name:'child:'+name,passed:child.getDefinition(q)===domain.getDefinition(q)});checks.push({name:'sibling-isolation:'+name,passed:sibling.getDefinition(q)!==domain.getDefinition(q)});}
 cs.retire();ss.retire();session.retire();return {rows,checks};
}
