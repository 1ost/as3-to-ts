import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {XML,XMLList} from '@FLASH@/utils/AS3CanonicalXMLReference';
import {as3ConstructXMLString} from '@FLASH@/utils/AS3XML';
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const domain=await session.load('constructors',new ApplicationDomain(ApplicationDomain.currentDomain));
 const classes=['OptionalXML','RequiredXML','OptionalXMLList','RequiredXMLList'].map(n=>domain.getDefinition('xmlctors.'+n) as any);
 const rows:any[]=[];let conversions=0;
 const fake={toString(){conversions++;return '<fake/>';}};
 const samples=[null,undefined,as3ConstructXMLString('<node/>'),as3ConstructXMLString('text'),new XMLList(),new XMLList([as3ConstructXMLString('<one/>')]),new XMLList([as3ConstructXMLString('<one/>'),as3ConstructXMLString('<two/>')]),{},fake,3,'<text/>',XML.prototype,XMLList.prototype];
 classes.forEach((Kind,c)=>{
  Kind.bodies=0;
  try{const empty=new Kind();rows.push({id:'default:'+c,value:[empty.saved===null,Kind.bodies]});}
  catch(e:any){rows.push({id:'default:'+c,value:[e.name,e.errorID,Kind.bodies]});}
  samples.forEach((value,i)=>{Kind.bodies=0;
   try{const item=new Kind(value);rows.push({id:c+':'+i,value:[item.saved===null,item.saved===value,Kind.bodies]});}
   catch(e:any){rows.push({id:c+':'+i,value:[e.name,e.errorID,Kind.bodies]});}
  });
  Kind.bodies=0;
  try{new Kind(null,null);rows.push({id:'extra:'+c,value:['accepted',Kind.bodies]});}
  catch(e:any){rows.push({id:'extra:'+c,value:[e.name,e.errorID,Kind.bodies]});}
 });
 rows.push({id:'conversions',value:conversions});
 let guards=0;
 for(const Kind of classes)for(const forged of [Object.create(XML.prototype),Object.create(XMLList.prototype)]){
  Kind.bodies=0;try{new Kind(forged);throw Error('Forged XML accepted');}catch(e:any){if(e.errorID!==1034)throw e;guards++;}
  if(Kind.bodies!==0)throw Error('Body entered before coercion');
 }
 session.retire();return {rows,guards};
}
