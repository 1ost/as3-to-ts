import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3VectorFromValues,as3VectorPrimitiveSpec} from '@FLASH@/utils/AS3Vector';
import {as3Is} from '@FLASH@/utils/AS3Type';
export async function run(module:any){
 const load=()=>createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1}).load('accessors',new ApplicationDomain(ApplicationDomain.currentDomain));
 const domain=await load(),Type=domain.getDefinition('vectoraccess.Subject');
 const rows:any[]=[],good=as3VectorFromValues(as3VectorPrimitiveSpec('String'),['en_Eu']),objects=as3VectorFromValues(as3VectorPrimitiveSpec('Object'),['en_Eu']);
 for(const [id,input] of [['good',good],['null',null],['undefined',undefined],['objects',objects],['array',['en_Eu']],['object',{}]]){
  for(const mode of ['get','set','static-get','static-set']){
   const subject=as3ConstructClass(Type);set(subject,'raw',input);set(Type,'staticRaw',input);set(Type,'staticReads',0);set(Type,'staticWrites',0);
   try{
    const result=mode==='get'?get(subject,'values'):mode==='set'?set(subject,'values',input):mode==='static-get'?get(Type,'shared'):set(Type,'shared',input);
    const raw=mode.startsWith('static-')?get(Type,'staticRaw'):get(subject,'raw');
    const reads=mode.startsWith('static-')?get(Type,'staticReads'):get(subject,'reads');
    const writes=mode.startsWith('static-')?get(Type,'staticWrites'):get(subject,'writes');
    rows.push({id:id+'-'+mode,value:[result===input,result===null,result===undefined,raw===input,raw===null,reads,writes]});
   }catch(e:any){rows.push({id:id+'-'+mode,error:[e.name,e.errorID,get(subject,'reads'),get(subject,'writes'),get(Type,'staticReads'),get(Type,'staticWrites')]});}
  }
 }
 const subject=as3ConstructClass(Type),first:any=get(subject,'fresh'),second:any=get(subject,'fresh');
 rows.push({id:'fresh',value:[first!==second,first.length,first[0],second[0]]});
 const other=await load(),Other=other.getDefinition('vectoraccess.Subject'),instance=as3ConstructClass(Other);
 const domainChecks=[Other!==Type,!as3Is(instance,Type)];if(domainChecks.some(v=>!v))throw Error('domain identity');
 return {rows,domainChecks};
}
