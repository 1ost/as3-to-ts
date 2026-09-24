import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3Is} from '@FLASH@/utils/AS3Type';
export async function run(parentModule,childModule){
 const root=new ApplicationDomain(ApplicationDomain.currentDomain);
 const parentSession=createNativeSourceClassLoadingSession({resolve:()=>parentModule,maxModules:1});await parentSession.load('parent',root);
 const Shared=root.getDefinition('packagecases.Shared'),parent=as3ConstructClass(Shared),access=as3ConstructClass(root.getDefinition('packagecases.ParentAccess'));
 const call=(value,name,args=[])=>as3CallValue(get(value,name),()=>args),rows=[],domainChecks=[];
 const record=(id,fn)=>{try{rows.push({id,value:fn()});}catch(e){let code;try{code=get(e,'errorID');}catch(_){throw Error(id+': '+String(e));}rows.push({id,value:['error',code]});}};
 const subjects=[],readers=[],classes=[],constructionRows=[];
 for(let index=0;index<3;index++){
  const domain=new ApplicationDomain(index===2?null:root);
  const session=createNativeSourceClassLoadingSession({resolve:()=>childModule,maxModules:1});const loaded=await session.load('child',domain);
  const type=domain.getDefinition('packagecases.Shared'),subject=as3ConstructClass(type);
  const reader=as3ConstructClass(domain.getDefinition('packagecases.ChildAccess'));
  const derived=as3ConstructClass(domain.getDefinition('packagecases.Derived')),alien=as3ConstructClass(domain.getDefinition('othercases.Alien'));
  if(index===0)for(const [name,ctor]of [['shared',Shared],['derived',domain.getDefinition('packagecases.Derived')],['alien',domain.getDefinition('othercases.Alien')]]){
   for(const [suffix,args]of [['zero',[]],['one',[1]],['two',[1,2]]]){
    try{const value=as3ConstructClass(ctor,args);constructionRows.push({id:name+'-'+suffix,value:[as3Is(value,Shared),call(access,'read',[value])]});}
    catch(e){let code;try{code=get(e,'errorID');}catch(_){throw Error(name+'-'+suffix+': '+String(e));}constructionRows.push({id:name+'-'+suffix,value:['error',code]});}
   }
   const value=as3ConstructClass(ctor);call(access,'write',[value,4294967295]);call(access,'bump',[value]);constructionRows.push({id:name+'-uint-wrap',value:call(access,'read',[value])});
  }
  subjects.push(subject);readers.push(reader);classes.push(type);
  const prefix=['child-a','child-b','isolated'][index];
  record(prefix+'-identity',()=>[type===Shared,as3Is(subject,Shared),call(reader,'accepts',[parent]),as3Is(derived,Shared)]);
  record(prefix+'-parent-read',()=>[call(access,'read',[subject]),call(access,'positive',[subject]),call(access,'limit',[type])]);
  record(prefix+'-child-read-parent',()=>[call(reader,'read',[parent]),call(reader,'positive',[parent]),call(reader,'limit',[Shared])]);
  record(prefix+'-child-write-parent',()=>{call(reader,'write',[parent,20+index]);call(reader,'bump',[parent]);return [call(parent,'publicCount'),call(access,'read',[parent])];});
  record(prefix+'-parent-write-child',()=>{call(access,'write',[subject,30+index]);call(access,'bump',[subject]);return [call(subject,'publicCount'),call(reader,'read',[subject])];});
  record(prefix+'-derived',()=>{call(access,'write',[derived,50+index]);call(reader,'bump',[derived]);return [call(derived,'inheritedCount'),call(derived,'publicCount')];});
  record(prefix+'-other-package',()=>{call(access,'write',[alien,60+index]);return [call(access,'read',[alien]),call(reader,'read',[alien]),call(alien,'ownCount'),call(alien,'read',[alien])];});
  record(prefix+'-other-read-shared',()=>call(alien,'read',[subject]));
  record(prefix+'-public-read',()=>get(subject,'count'));
  domainChecks.push(loaded.active,root.getDefinition('packagecases.Shared')===Shared);
  session.retire();domainChecks.push(!loaded.active,root.getDefinition('packagecases.Shared')===Shared);
  record(prefix+'-retained',()=>{call(reader,'bump',[subject]);return [call(access,'read',[subject]),call(reader,'read',[parent])];});
 }
 record('sibling-class-identity',()=>[classes[0]===classes[1],classes[0]===classes[2]]);
 record('sibling-access-isolated',()=>{call(readers[0],'bump',[subjects[2]]);return [call(readers[1],'read',[subjects[2]]),call(readers[2],'read',[subjects[0]])];});
 record('isolated-access-parent',()=>{call(readers[2],'bump',[parent]);return call(access,'read',[parent]);});
 if(domainChecks.some(value=>value!==true))throw Error('Package module lifecycle mismatch');
 return {rows,domainChecks,constructionRows};
}
