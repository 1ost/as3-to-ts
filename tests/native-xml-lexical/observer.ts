import {XML} from '@FLASH@/utils/AS3CanonicalXMLReference';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
export async function run(nativeSourceClassModule:any){
 const session=createNativeSourceClassLoadingSession({resolve:()=>nativeSourceClassModule,maxModules:1});
 try{
 const domain=await session.load('xml',new ApplicationDomain(ApplicationDomain.currentDomain)),Subject=domain.getDefinition('XMLSubject') as any,rows:any[]=[];
 const samples=['<root tag="x"><state name="a">one</state><state name="b">two</state></root>','<root tag="y"><state name="c">three</state></root>','<root/>'];
 for(let i=0;i<samples.length;i++){
  const s=new Subject(new XML(samples[i]));rows.push({id:'sample-'+i,value:s.snapshot()});rows.push({id:'missing-'+i,value:s.missing()});rows.push({id:'shadow-'+i,value:s.shadow(new XML('<root><state>local</state></root>'))});
 }
 try{new Subject(null).snapshot();}catch(e){rows.push({id:'null',value:[e.name,e.errorID]});}
 return {rows};
 }finally{session.retire();}
}
