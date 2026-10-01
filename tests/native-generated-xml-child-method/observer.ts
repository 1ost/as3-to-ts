import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {XML,XMLList} from '@FLASH@/utils/AS3CanonicalXMLReference';
import {as3XMLChildNamed as child,as3ConstructXMLString as construct} from '@FLASH@/utils/AS3XML';
import {as3CoerceString} from '@FLASH@/utils/AS3String';
const samples:string[]=@SAMPLES@;
const error=(action:()=>unknown)=>{try{action();return 'none';}catch(e){return e.name+':'+e.errorID;}};
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 const loaded=await session.load('xml-child-method',new ApplicationDomain(ApplicationDomain.currentDomain));
 const ChildReader:any=loaded.getDefinition('model.ChildReader'),probe=new ChildReader();
 XML.prettyPrinting=false;const rows:any[]=[];
 samples.forEach((text,index)=>{const conf=construct(text);rows.push({id:'read-'+index,value:probe.read(conf)},
  {id:'inspect-'+index,value:probe.inspect(conf)});});
 const first=construct(samples[0]);rows.push({id:'selection',value:[probe.select(first).length,as3CoerceString(probe.select(first)),probe.select(first).at(0)===child(first,'uiUrl').at(0)]});
 const group=construct('<root><r><uiUrl>a</uiUrl></r><r><uiUrl>b</uiUrl><wrap><uiUrl>skip</uiUrl></wrap></r></root>');
 rows.push({id:'list',value:probe.list(child(group,'r'))},{id:'empty-list',value:probe.list(child(group,'missing'))},
  {id:'null-read',value:error(()=>probe.read(null))},{id:'null-select',value:error(()=>probe.select(null))},{id:'null-list',value:error(()=>probe.list(null))});
 const ListReturn:any=loaded.getDefinition('model.ListReturn'),boundary=new ListReturn();
 const list=new XMLList([construct('<x/>'),construct('<y/>')]),empty=new XMLList();
 for(const [label,input] of [['list',list],['empty',empty],['null',null],['undefined',undefined],['xml',construct('<x/>')],['object',{}],['string','<x/>'],['number',1],['boolean',false]]){
  let result=null;const failure=error(()=>{result=boundary.pass(input);});rows.push({id:'return-'+label,value:[failure,result===input,result===null]});
 }
 session.retire();return rows;
}