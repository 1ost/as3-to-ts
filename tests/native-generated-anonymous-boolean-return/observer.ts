import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const domain=await session.load('bool-returns',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Functions=domain.getDefinition('boolcases.Functions') as any,Item=domain.getDefinition('boolcases.Item') as any,subject=new Functions();
 const rows:any[]=[];let conversions=0;
 const fake={toString(){conversions++;return '';},valueOf(){conversions++;return 0;}};
 const samples=[null,undefined,false,true,0,-0,NaN,Infinity,-Infinity,1,-1,'','0',[],{},fake],fn=subject.raw();
 samples.forEach((v,i)=>{const value=fn(v);rows.push({id:'raw:'+i,value:[value,typeof value]});});
 samples.forEach((v,i)=>{const value=subject.fallthrough(v)();rows.push({id:'fallthrough:'+i,value:[value,typeof value]});});
 const yes=new Item('yes'),no=new Item('no'),pred=subject.predicate('yes');
 [yes,no,null,undefined,{},fake,Item.prototype].forEach((v,i)=>{try{rows.push({id:'predicate:'+i,value:pred(v)});}catch(e:any){rows.push({id:'predicate:'+i,error:[e.name,e.errorID]});}});
 [[fn,[]],[fn,[1,2]],[pred,[]],[pred,[yes,no]],[subject.fallthrough(0),[1,2]]].forEach(([fn,args]:any,i)=>{try{rows.push({id:'arity:'+i,value:fn.apply(null,args)});}catch(e:any){rows.push({id:'arity:'+i,error:[e.name,e.errorID]});}});
 rows.push({id:'find',value:[subject.find([no,yes,no],'yes')===yes,subject.find([no],'yes')===null]});
 rows.push({id:'length',value:[fn.length,pred.length,subject.fallthrough(0).length]});rows.push({id:'conversions',value:conversions});
 let hostGuards=0,hostFailures=0;for(const v of [Object.create(Item.prototype),new Proxy(yes,{}),{id:'yes'}]){try{pred(v);hostFailures++;}catch(e:any){if(e.errorID===1034)hostGuards++;else hostFailures++;}}
 session.retire();return {rows,hostGuards,hostFailures};
}
