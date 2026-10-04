import {XML} from '@FLASH@/utils/AS3CanonicalXMLReference';
import {as3ConstructXMLString} from '@FLASH@/utils/AS3XML';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
export async function run(nativeSourceClassModule:any){
 const session=createNativeSourceClassLoadingSession({resolve:()=>nativeSourceClassModule,maxModules:1}),settings=XML.settings();
 try{
 XML.ignoreComments=false;XML.ignoreProcessingInstructions=false;XML.prettyPrinting=false;
 const domain=await session.load('xml',new ApplicationDomain(ApplicationDomain.currentDomain)),Subject=domain.getDefinition('TraversalSubject') as any,rows:any[]=[];
 const samples=['<r><menuButton><label textKey="hi" url="old"/></menuButton><x aKey="one"><y bKey="two"/></x></r>','<r/>','<r>before<x labelKey="hello"/>after<!--comment--></r>'];
 for(let i=0;i<samples.length;i++){
  const root=as3ConstructXMLString(samples[i]),s=new Subject(root),saved=s.all();
  rows.push({id:'rewrite-'+i,value:[s.rewrite()===root,root.toXMLString(),s.count(saved)]});
  rows.push({id:'write-'+i,value:[s.write('extra','value'),s.attrs().toXMLString()]});
  s.writeNested('nested');rows.push({id:'nested-'+i,value:root.toXMLString()});
  rows.push({id:'null-loop-'+i,value:s.count(null)});
  rows.push({id:'names-'+i,value:[s.name(as3ConstructXMLString('text')),s.name(as3ConstructXMLString('<r xmlns="urn:test"/>')),s.name(as3ConstructXMLString('<p:r xmlns:p="urn:p"/>'))]});
 }
 try{new Subject(null).rewrite();}catch(e){rows.push({id:'null-receiver',value:[e.name,e.errorID]});}
 return {rows};
 }finally{XML.setSettings(settings);session.retire();}
}
