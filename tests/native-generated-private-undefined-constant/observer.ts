import {declareAS3ReferenceType} from '@FLASH@/utils/AS3DeclarationType';
import {registerAS3GeneratedClass} from '@FLASH@/utils/AS3GeneratedClass';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {resolveAS3LexicalMember,as3GetLexicalMember,as3SetLexicalMember,getAS3LexicalObjectConstantInitializer,getAS3LexicalClassConstantInitializer,registerAS3LexicalMembers} from '@FLASH@/utils/AS3LexicalMembers';
export async function run(module:NativeSourceClassModule) {
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:3});
 let checks=0;const check=(value:boolean)=>{if(!value)throw Error('Private constant lifecycle '+checks);checks++;};
 const reject=(fn:()=>unknown,code?:number)=>{let failed=false;try{fn();}catch(e){failed=code===undefined||e.errorID===code;}check(failed);};
 try {
  const domain=await session.load('subject',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Probe=domain.getDefinition('PrivateUndefinedProbe') as any,result=new Probe().snapshot();
  check(result.ready&&!result.failure);
  const Subject=domain.getDefinition('cases.Box') as any,initial=Subject.state();
  const empty=()=>({variables:[],constants:[],accessors:[],methods:[]});
  const publish=(name:string)=>{const authority=declareAS3ReferenceType(name);function Owner(){};Object.defineProperty(Owner,'prototype',{writable:false});registerAS3GeneratedClass(Owner,{declaration:authority,metadata:{name,base:'Object',isDynamic:false,isFinal:false,instance:empty(),statics:empty()},instanceTraits:[],staticTraits:[]});return Owner;};
  const Owner=publish('constantguard::Owner'),member={name:'value',visibility:'private',static:true,kind:'constant',type:'Object'} as const;
  const scope=registerAS3LexicalMembers(Owner,null,[member]),slot=resolveAS3LexicalMember(scope,'value','private',true);
  check(as3GetLexicalMember(Owner,slot)===null);
  const initialize=getAS3LexicalObjectConstantInitializer(Owner,slot),value={key:1};initialize(value);
  check(as3GetLexicalMember(Owner,slot)===value);value.key=2;check((as3GetLexicalMember(Owner,slot) as any).key===2);
  reject(()=>as3SetLexicalMember(Owner,slot,{}),1074);
  reject(()=>initialize({}));reject(()=>getAS3LexicalObjectConstantInitializer(Owner,slot)({}));
  reject(()=>getAS3LexicalClassConstantInitializer(Owner,slot));
  reject(()=>getAS3LexicalObjectConstantInitializer(Owner,{} as any));
  const OtherOwner=publish('constantguard::Other');reject(()=>getAS3LexicalObjectConstantInitializer(OtherOwner,slot));
  const nilScope=registerAS3LexicalMembers(OtherOwner,null,[member]),nullable=resolveAS3LexicalMember(nilScope,'value','private',true);
  const initNull=getAS3LexicalObjectConstantInitializer(OtherOwner,nullable);initNull(null);reject(()=>initNull({}));
  for(const [index,change]of [{value:{}},{value:undefined},{static:false},{visibility:'protected'}].entries())
   reject(()=>registerAS3LexicalMembers(publish('constantguard::Invalid'+index),null,[{...member,...change} as any]));
  const Sentinel=publish('constantguard::Sentinel'),sentinel={name:'sentinel',visibility:'private',static:true,kind:'constant',type:'*',value:undefined} as const;
  const sentinelScope=registerAS3LexicalMembers(Sentinel,null,[sentinel]),sentinelSlot=resolveAS3LexicalMember(sentinelScope,'sentinel','private',true);
  check(as3GetLexicalMember(Sentinel,sentinelSlot)===undefined);check(as3GetLexicalMember(Sentinel,sentinelSlot)!==null);
  reject(()=>as3SetLexicalMember(Sentinel,sentinelSlot,undefined),1074);reject(()=>as3SetLexicalMember(Sentinel,sentinelSlot,null),1074);
  reject(()=>getAS3LexicalObjectConstantInitializer(Sentinel,sentinelSlot));
  for(const [index,change]of [{value:null},{value:1},{static:false},{visibility:'protected'}].entries())
   reject(()=>registerAS3LexicalMembers(publish('constantguard::InvalidSentinel'+index),null,[{...sentinel,...change} as any]));
  const omitted:any={...sentinel};delete omitted.value;
  reject(()=>registerAS3LexicalMembers(publish('constantguard::OmittedSentinel'),null,[omitted]));
  const sibling=await session.load('sibling',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Log=sibling.getDefinition('cases.Log') as any;check(Log.classes.length===0);Log.fail=false;
  const Other=sibling.getDefinition('cases.Box') as any,other=Other.state();check(Subject!==Other);check(initial[0]!==other[0]);check(other[0].value===undefined);
  const child=await session.load('child',new ApplicationDomain(domain.applicationDomain));
  check(child.getDefinition('cases.Box')===Subject);
  return {rows:result.observations,checks};
 }finally{session.retire();}
}
