import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {as3ConstructXMLString,as3XMLChildNamed,as3XMLAttribute} from '@FLASH@/utils/AS3XML';
import {XML,XMLList} from '@FLASH@/utils/AS3CanonicalXMLReference';
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const domain=await session.load('xml',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Reader=domain.getDefinition('xmlcases.Reader') as any,Config=domain.getDefinition('xmlcases.Config') as any;
 const reader=new Reader(),rows:any[]=[],normalize=(values:any[])=>values.map(v=>typeof v==='number'&&Number.isNaN(v)?'NaN':v);
 XML.prettyPrinting=false;
 const samples:string[]=@SAMPLES@;
 samples.forEach((text,index)=>{const value=as3ConstructXMLString(text);Config.value=value;Config.reads=0;
  rows.push({id:'local:'+index,value:normalize(reader.local(value))},{id:'calls:'+index,value:normalize(reader.calls())},{id:'reads:'+index,value:Config.reads});
 });
 Config.value=null;Config.reads=0;
 try{reader.local(null);throw Error('Null accepted');}catch(e:any){rows.push({id:'null-local',value:[e.name,e.errorID]});}
 try{reader.calls();throw Error('Null accepted');}catch(e:any){rows.push({id:'null-call',value:[e.name,e.errorID,Config.reads]});}
 const value=as3ConstructXMLString("<r><asset id='a'/><asset id='b'/></r>");
 rows.push({id:'identity',value:[as3XMLChildNamed(value,'asset')!==as3XMLChildNamed(value,'asset'),as3XMLChildNamed(value,'asset').at(0)===as3XMLChildNamed(value,'asset').at(0),as3XMLAttribute(as3XMLChildNamed(value,'asset'),'id').at(0)===as3XMLAttribute(as3XMLChildNamed(value,'asset'),'id').at(0)]});
 let guards=0;Config.value=value;
 for(const fake of [{},Object.create(XML.prototype),new XMLList(),Object.create(XMLList.prototype)]){
  try{Config.value=fake;throw Error('Invalid XML field accepted');}catch(error:any){if(error.errorID!==1034)throw error;guards++;}
  if(Config.value!==value)throw Error('Failed write changed XML field');
 }
 session.retire();return {rows,guards};
}
