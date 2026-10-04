import {as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {describeRegisteredFlashType} from '@FLASH@/utils/FlashTypeMetadata';
export function observe({Base,Child,Grand,Data,Other}:any){
 const base=new Base(),child=new Child(),grand=new Grand(),token=new Data(7),rows:any[]=[];
 rows.push({id:'initial',value:[base.value===null,child.value===null,grand.value===null]});
 child.value=token;rows.push({id:'setter-override',value:[child.value===token,child.stored===token,child.writes]});
 grand.value=token;rows.push({id:'getter-override',value:[grand.value===token,grand.stored===token,grand.writes]});
 rows.push({id:'base-virtual',value:[grand.throughBase(null)===null,grand.value===null,grand.writes]});
 const inputs=[token,null,undefined,new Other(),{},7,'text'];
 for(let i=0;i<inputs.length;i++){
  let error='none',before=child.writes;
  try{set(child,'value',inputs[i]);}catch(e){error=e.name+':'+e.errorID;}
  rows.push({id:'dynamic-'+i,value:[error,child.value===token,child.value===null,child.writes-before]});
 }
 for(const subject of [base,child,grand]){
  const desc=describeRegisteredFlashType(subject)!,a=desc.accessors.find(x=>x.name==='value')!;
  rows.push({id:'reflection-'+desc.name,value:[a.type,a.access,a.declaredBy]});
 }
 return rows;
}
