import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {declareAS3ReferenceType} from '@FLASH@/utils/AS3DeclarationType';
import {registerAS3GeneratedClass} from '@FLASH@/utils/AS3GeneratedClass';
import {resolveAS3LexicalMember,as3GetLexicalMember,as3SetLexicalMember,getAS3LexicalStringConstantInitializer,registerAS3LexicalMembers} from '@FLASH@/utils/AS3LexicalMembers';
export async function run(module:NativeSourceClassModule) {
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:3});
 let checks=0;const check=(value:boolean)=>{if(!value)throw Error('String constant guard '+checks);checks++;};
 const reject=(fn:()=>unknown,code?:number)=>{let failed=false;try{fn();}catch(e){failed=code===undefined||e.errorID===code;}check(failed);};
 try{
  const domain=await session.load('subject',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Probe=domain.getDefinition('cases.Probe') as any,result=new Probe().snapshot();check(result.ready&&!result.failure);
  const other=await session.load('other',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Other=other.getDefinition('cases.Probe') as any;check(Other!==Probe);check(JSON.stringify(new Other().snapshot())===JSON.stringify(result));
  check(domain.getDefinition('cases.Constants')!==other.getDefinition('cases.Constants'));
  const empty=()=>({variables:[],constants:[],accessors:[],methods:[]});
  const publish=(name:string)=>{const authority=declareAS3ReferenceType(name);function Owner(){};Object.defineProperty(Owner,'prototype',{writable:false});registerAS3GeneratedClass(Owner,{declaration:authority,metadata:{name,base:'Object',isDynamic:false,isFinal:false,instance:empty(),statics:empty()},instanceTraits:[],staticTraits:[]});return Owner;};
  const Owner=publish('stringguard::Owner'),member={name:'value',visibility:'private',static:true,kind:'constant',type:'String'} as const;
  const scope=registerAS3LexicalMembers(Owner,null,[member]),slot=resolveAS3LexicalMember(scope,'value','private',true);
  check(as3GetLexicalMember(Owner,slot)===null);
  const initialize=getAS3LexicalStringConstantInitializer(Owner,slot),failure={};
  let caught:unknown;try{initialize({toString(){throw failure;}});}catch(e){caught=e;}check(caught===failure);check(as3GetLexicalMember(Owner,slot)===null);
  initialize(123);check(as3GetLexicalMember(Owner,slot)==='123');
  reject(()=>as3SetLexicalMember(Owner,slot,'different'),1074);reject(()=>initialize('again'));
  reject(()=>getAS3LexicalStringConstantInitializer(Owner,{} as any));
  const OtherOwner=publish('stringguard::Other');reject(()=>getAS3LexicalStringConstantInitializer(OtherOwner,slot));
  const nilScope=registerAS3LexicalMembers(OtherOwner,null,[member]),nil=resolveAS3LexicalMember(nilScope,'value','private',true);
  const initNull=getAS3LexicalStringConstantInitializer(OtherOwner,nil);initNull(null);check(as3GetLexicalMember(OtherOwner,nil)===null);reject(()=>initNull('again'));
  const Literal=publish('stringguard::Literal'),literalScope=registerAS3LexicalMembers(Literal,null,[{...member,value:'early'}]);
  const literal=resolveAS3LexicalMember(literalScope,'value','private',true);check(as3GetLexicalMember(Literal,literal)==='early');reject(()=>getAS3LexicalStringConstantInitializer(Literal,literal)('changed'));
  for(const [index,change]of [{value:undefined},{value:null},{static:false},{visibility:'protected'},{visibility:'internal'}].entries())
   reject(()=>registerAS3LexicalMembers(publish('stringguard::Invalid'+index),null,[{...member,...change} as any]));
  return {rows:JSON.parse(JSON.stringify(result.observations)),checks};
 }finally{session.retire();}
}
