import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3CreateError} from '@FLASH@/errors/AS3SourceError';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('rest-signatures',domain);
 const construct=name=>as3ConstructClass(domain.getDefinition('restcases.'+name),[]);
 const subjects=['Parent','Child','Grandchild'].map(construct),token={marker:true},rows=[];
 const calls=[[],[1],[1,2],['3.8',-4.9,null,undefined,token],[undefined,null,token,token]];
 const call=(subject,name,args)=>as3CallValue(get(subject,name),()=>args);
 for(let j=0;j<subjects.length;j++){
  const subject=subjects[j];
  for(let i=0;i<calls.length;i++){
   set(subject,'path','');set(subject,'tail',null);let error='ok',id=0;
   try{call(subject,'replaceChildren',calls[i]);}catch(e){error=e.name;id=e.errorID;}
   const tail=get(subject,'tail');
   rows.push({id:'replace-'+j+'-'+i,value:[error,id,get(subject,'path'),get(subject,'first'),get(subject,'last'),tail===null?-1:tail.length,tail!==null&&tail===calls[i],tail!==null&&tail.length>0&&tail[tail.length-1]===token]});
   if(j>0&&tail!==null)rows.push({id:'fresh-'+j+'-'+i,value:tail!==get(subject,'childTail')});
  }
  const optionalCalls=[[],[undefined],[12,token,null]];
  for(let i=0;i<optionalCalls.length;i++){
   set(subject,'path','');rows.push({id:'optional-'+j+'-'+i,value:[call(subject,'optional',optionalCalls[i]),get(subject,'path'),get(subject,'tail').length]});
  }
  rows.push({id:'only-'+j,value:[call(subject,'only',[]),call(subject,'only',[token,null])]});
 }
 const child=construct('Child'),other=construct('Parent');
 call(child,'direct',['6.9',-2.9,token]);
 rows.push({id:'direct',value:[get(child,'path'),get(child,'first'),get(child,'last'),get(child,'tail').length,get(child,'tail')[0]===token]});
 set(child,'path','');call(child,'directEmpty',[]);rows.push({id:'direct-empty',value:[get(child,'path'),get(child,'first'),get(child,'last'),get(child,'tail').length]});
 set(child,'path','');call(child,'applyParent',[other,[8,9,token]]);
 rows.push({id:'super-bound',value:[get(child,'path'),get(child,'first'),get(child,'last'),get(child,'tail')[0]===token,get(other,'path'),get(other,'tail')===null]});
 let effects=[];
 let a={valueOf(){effects.push('a');return 2.8;}},b={valueOf(){effects.push('b');return -3.8;}};
 set(child,'path','');call(child,'direct',[a,b,token]);rows.push({id:'coercion',value:[effects.join(','),get(child,'first'),get(child,'last'),get(child,'path')]});
 effects=[];a={valueOf(){effects.push('throw');throw as3CreateError('sentinel',73);}};
 set(child,'path','');try{call(child,'direct',[a,b,token]);}catch(f){rows.push({id:'coercion-throw',value:[f.name,f.errorID,effects.join(','),get(child,'path')]});}
 return {rows};
}
