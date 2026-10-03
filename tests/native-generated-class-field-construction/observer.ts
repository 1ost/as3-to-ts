import {declareAS3ReferenceType} from '@FLASH@/utils/AS3DeclarationType';
import {registerAS3GeneratedClass} from '@FLASH@/utils/AS3GeneratedClass';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {registerAS3LexicalMembers,initializeAS3LexicalInstance,resolveAS3LexicalMember,as3ConstructLexicalClass,as3SetLexicalMember} from '@FLASH@/utils/AS3LexicalMembers';
export async function run(module:NativeSourceClassModule,extras=true) {
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:3});
 let checks=0;const check=(value:boolean)=>{if(!value)throw Error('Class field construction guard '+checks);checks++;};
 const reject=(fn:()=>unknown,code?:number)=>{let failed=false;try{fn();}catch(e){failed=code===undefined||e.errorID===code;}check(failed);};
 try {
  const domain=await session.load('subject',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Probe=domain.getDefinition('ClassFieldProbe') as any,result=new Probe().snapshot();
  check(result.ready&&!result.failure);
  if(extras){
   const Holder=domain.getDefinition('cases.Holder') as any,A=domain.getDefinition('cases.TargetA') as any,B=domain.getDefinition('cases.TargetB') as any;
   const empty=()=>({variables:[],constants:[],accessors:[],methods:[]});
   const name='constructionguard::Owner',authority=declareAS3ReferenceType(name);
   function Owner(){};Object.defineProperty(Owner,'prototype',{writable:false});
   const generation=registerAS3GeneratedClass(Owner,{declaration:authority,metadata:{name,base:'Object',isDynamic:false,isFinal:false,instance:empty(),statics:empty()},instanceTraits:[],staticTraits:[]});
   const scope=registerAS3LexicalMembers(Owner,null,[{name:'memberType',visibility:'private',kind:'variable',type:'Class'},{name:'number',visibility:'private',kind:'variable',type:'Number'}]);
   const slot=resolveAS3LexicalMember(scope,'memberType','private'),h=new Owner();
   generation.enterInstance(h);initializeAS3LexicalInstance(scope,h);as3SetLexicalMember(h,slot,A);
   let calls=0;const value=as3ConstructLexicalClass(h,slot,()=>{calls++;as3SetLexicalMember(h,slot,B);return ['native'];}) as any;
   check(calls===1);check(value instanceof B);check(value.value==='native');
   reject(()=>as3ConstructLexicalClass(null,slot,()=>{calls++;return [];}),1009);check(calls===2);
   as3SetLexicalMember(h,slot,null);reject(()=>as3ConstructLexicalClass(h,slot,()=>{calls++;return [];}),1007);check(calls===3);
   reject(()=>as3ConstructLexicalClass(h,{} as any,()=>{calls++;return [];}));check(calls===3);
   reject(()=>as3ConstructLexicalClass(h,slot,()=>{calls++;return [];},{}));check(calls===3);
   reject(()=>as3ConstructLexicalClass(h,resolveAS3LexicalMember(scope,'number','private'),()=>{calls++;return [];}));check(calls===3);
   as3SetLexicalMember(h,slot,A);reject(()=>as3ConstructLexicalClass(h,slot,()=>['one','two']),1063);
   const other=await session.load('other',new ApplicationDomain(ApplicationDomain.currentDomain));
   const Other=other.getDefinition('cases.Holder') as any,OtherA=other.getDefinition('cases.TargetA') as any;
   check(Other!==Holder);const native=new Other(OtherA).empty();check(native instanceof OtherA);check(!(native instanceof A));
   reject(()=>as3ConstructLexicalClass(new Other(OtherA),slot,()=>[]));
  }
  return {rows:result.observations,checks};
 }finally{session.retire();}
}
