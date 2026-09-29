import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const domain=await session.load('names',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Target=domain.getDefinition('staticnames.Target') as any,Caller=domain.getDefinition('staticnames.Caller') as any;
 const caller=new Caller(),rows:any[]=[];Target.bodies=0;
 rows.push({id:'calls',value:caller.calls()});rows.push({id:'bodies',value:Target.bodies});
 const f=caller.extract();rows.push({id:'identity',value:f===caller.extract()});
 rows.push({id:'extracted',value:f(10,4,5)});rows.push({id:'closure-call',value:f.call(null,11,2)});rows.push({id:'closure-apply',value:f.apply(null,[12,1,2,3])});
 Target.bodies=0;try{f();rows.push({id:'arity',value:'accepted'});}catch(e:any){rows.push({id:'arity',value:[e.name,e.errorID,Target.bodies]});}
 session.retire();return {rows};
}
