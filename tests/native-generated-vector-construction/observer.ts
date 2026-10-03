import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {as3VectorCreate,as3VectorPrimitiveSpec} from '@FLASH@/utils/AS3Vector';
export async function run(module:NativeSourceClassModule,extras=true) {
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:3});
 let checks=0;const check=(value:boolean)=>{if(!value)throw Error('Vector constructor guard '+checks);checks++;};
 const reject=(fn:()=>unknown,code?:number)=>{let failed=false;try{fn();}catch(e){failed=code===undefined||e.errorID===code;}check(failed);};
 try {
  const domain=await session.load('subject',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Probe=domain.getDefinition('VectorConstructionProbe') as any,result=new Probe().snapshot();
  check(result.ready&&!result.failure);
  if(extras){
   const spec=as3VectorPrimitiveSpec('int');
   check(as3VectorCreate(spec).length===0);
   check(as3VectorCreate(spec,2.9).length===2);
   check(as3VectorCreate(spec,4294967298).length===2);
   check(as3VectorCreate(spec,NaN).length===0);
   for(const input of [undefined,null,true,false,'2',{},[],()=>2])reject(()=>as3VectorCreate(spec,input),2005);
   let calls=0;reject(()=>as3VectorCreate(spec,{valueOf(){calls++;return 2;},toString(){calls++;return '2';}}),2005);check(calls===0);
   const fixed=as3VectorCreate(spec,1,{valueOf(){calls++;return false;}});check(fixed.fixed&&calls===0);
   reject(()=>fixed.push(1),1126);check(fixed.length===1);
   reject(()=>as3VectorCreate({} as any,0));
   reject(()=>as3VectorCreate(spec,1048577));
   const other=await session.load('other',new ApplicationDomain(ApplicationDomain.currentDomain));
   check(other.getDefinition('cases.Item')!==domain.getDefinition('cases.Item'));
   const OtherProbe=other.getDefinition('VectorConstructionProbe') as any;check(JSON.stringify(new OtherProbe().snapshot())===JSON.stringify(result));
  }
  return {rows:result.observations,checks};
 }finally{session.retire();}
}
