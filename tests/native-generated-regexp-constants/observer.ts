import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {declareAS3ReferenceType} from '@FLASH@/utils/AS3DeclarationType';
import {registerAS3GeneratedClass} from '@FLASH@/utils/AS3GeneratedClass';
import {resolveAS3LexicalMember,as3GetLexicalMember,as3SetLexicalMember,getAS3LexicalReferenceConstantInitializer,getAS3LexicalObjectConstantInitializer,registerAS3LexicalMembers} from '@FLASH@/utils/AS3LexicalMembers';
import {RegExp as SourceRegExp,isFlashRegExp} from '@FLASH@/utils/AS3CanonicalRegExpReference';
export async function run(module:NativeSourceClassModule) {
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:3});
 let checks=0;const check=(value:boolean)=>{if(!value)throw Error('RegExp constant guard '+checks);checks++;};
 try {
  const domain=await session.load('subject',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Probe=domain.getDefinition('RegExpConstantsProbe') as any,result=new Probe().snapshot();
  check(result.ready&&!result.failure);
  const other=await session.load('other',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Other=other.getDefinition('RegExpConstantsProbe') as any;
  check(Other!==Probe);check(JSON.stringify(new Other().snapshot())===JSON.stringify(result));
  const Child=domain.getDefinition('cases.Patterns') as any,OtherChild=other.getDefinition('cases.Patterns') as any;
  check(Child!==OtherChild);check(Child.pattern()!==OtherChild.pattern());check(Child.pattern()===Child.pattern());check(!(new OtherChild() instanceof Child));
  check(isFlashRegExp(Child.pattern()));check(!(Child.pattern() instanceof RegExp));
  const reject=(fn:()=>unknown,code?:number)=>{let failed=false;try{fn();}catch(e){failed=code===undefined||e.errorID===code;}check(failed);};
  const empty=()=>({variables:[],constants:[],accessors:[],methods:[]});
  const publish=(name:string)=>{const authority=declareAS3ReferenceType(name);function Owner(){};Object.defineProperty(Owner,'prototype',{writable:false});registerAS3GeneratedClass(Owner,{declaration:authority,metadata:{name,base:'Object',isDynamic:false,isFinal:false,instance:empty(),statics:empty()},instanceTraits:[],staticTraits:[]});return Owner;};
  const Owner=publish('regexpguard::Owner'),member={name:'value',visibility:'private',static:true,kind:'constant',type:{name:'RegExp',reference:SourceRegExp}} as const;
  const scope=registerAS3LexicalMembers(Owner,null,[member]),slot=resolveAS3LexicalMember(scope,'value','private',true);
  check(as3GetLexicalMember(Owner,slot)===null);
  const initialize=getAS3LexicalReferenceConstantInitializer(Owner,slot);
  reject(()=>initialize(/a/),1034);check(as3GetLexicalMember(Owner,slot)===null);
  const value=Child.pattern();initialize(value);check(as3GetLexicalMember(Owner,slot)===value);
  value.lastIndex=7;check((as3GetLexicalMember(Owner,slot) as any).lastIndex===7);value.lastIndex=0;
  reject(()=>as3SetLexicalMember(Owner,slot,value),1074);
  reject(()=>initialize(value));reject(()=>getAS3LexicalReferenceConstantInitializer(Owner,slot)(value));
  reject(()=>getAS3LexicalObjectConstantInitializer(Owner,slot));
  reject(()=>getAS3LexicalReferenceConstantInitializer(Owner,{} as any));
  const OtherOwner=publish('regexpguard::Other');reject(()=>getAS3LexicalReferenceConstantInitializer(OtherOwner,slot));
  const nilScope=registerAS3LexicalMembers(OtherOwner,null,[member]),nullable=resolveAS3LexicalMember(nilScope,'value','private',true);
  const initNull=getAS3LexicalReferenceConstantInitializer(OtherOwner,nullable);initNull(null);reject(()=>initNull(value));
  for(const [index,change]of [{value},{value:undefined},{static:false},{visibility:'protected'},
      {type:{name:'RegExp',reference:RegExp}},{type:{name:'Wrong',reference:SourceRegExp}}].entries())
   reject(()=>registerAS3LexicalMembers(publish('regexpguard::Invalid'+index),null,[{...member,...change} as any]));
  // Use the same JSON transport as AIR and the browser. exec's named fields
  // are observed separately; JSON array serialization retains indexed values.
  return {rows:JSON.parse(JSON.stringify(result.observations)),checks};
 }finally{session.retire();}
}
