import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {GroupElement,TextElement} from '@FLASH@/utils/AS3CanonicalContentElementReference';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('signatures',domain);
 const subjects=['Parent','Child','Grandchild'].map(name=>as3ConstructClass(domain.getDefinition('signaturecases.'+name),[]));
 const values=[new GroupElement(),null,undefined,new TextElement('x'),{},7],rows=[];
 const call=(subject,name,args)=>as3CallValue(get(subject,name),()=>args);
 for(let j=0;j<subjects.length;j++){
  const subject=subjects[j];
  for(let i=0;i<values.length;i++){
   const input=values[i];let result,state;
   set(subject,'path','');
   try{result=call(subject,'relay',[input]);state=['ok',result===input,result===null,get(subject,'path')];}catch(e){state=[e.name,e.errorID,get(subject,'path')];}
   rows.push({id:'relay-'+j+'-'+i,value:state});
   set(subject,'raw',input);set(subject,'path','');
   try{result=call(subject,'read',[]);state=['ok',result===input,result===null,get(subject,'path')];}catch(e){state=[e.name,e.errorID,get(subject,'path')];}
   rows.push({id:'read-'+j+'-'+i,value:state});
  }
 }
 set(subjects[1],'path','');const result=call(subjects[1],'callSuper',[values[0]]);
 rows.push({id:'super',value:[result===values[0],get(subjects[1],'path')]});
 return {rows};
}
