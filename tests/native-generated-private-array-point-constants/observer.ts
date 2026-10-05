import {Point} from '@FLASH@/utils/AS3CanonicalPointReference';
import {declareAS3ReferenceType} from '@FLASH@/utils/AS3DeclarationType';
import {registerAS3GeneratedClass} from '@FLASH@/utils/AS3GeneratedClass';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {resolveAS3LexicalMember,as3GetLexicalMember,as3SetLexicalMember,getAS3LexicalReferenceConstantInitializer,getAS3LexicalClassConstantInitializer,registerAS3LexicalMembers} from '@FLASH@/utils/AS3LexicalMembers';
export async function run(module:NativeSourceClassModule) {
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:3});
 let checks=0;const check=(value:boolean)=>{if(!value)throw Error('Private constant lifecycle '+checks);checks++;};
 const reject=(fn:()=>unknown,code?:number)=>{let failed=false;try{fn();}catch(e){failed=code===undefined||e.errorID===code;}check(failed);};
 try {
  const domain=await session.load('subject',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Probe=domain.getDefinition('PrivateArrayPointProbe') as any,result=new Probe().snapshot();
  check(result.ready&&!result.failure);
  const Subject=domain.getDefinition('cases.Box') as any,initial=Subject.state();
  const empty=()=>({variables:[],constants:[],accessors:[],methods:[]});
  const publish=(name:string)=>{const authority=declareAS3ReferenceType(name);function Owner(){};Object.defineProperty(Owner,'prototype',{writable:false});registerAS3GeneratedClass(Owner,{declaration:authority,metadata:{name,base:'Object',isDynamic:false,isFinal:false,instance:empty(),statics:empty()},instanceTraits:[],staticTraits:[]});return Owner;};
  const Owner=publish('constantguard::Owner'),member={name:'value',visibility:'private',static:true,kind:'constant',type:{name:'Array',reference:Array}} as const;
  const scope=registerAS3LexicalMembers(Owner,null,[member]),slot=resolveAS3LexicalMember(scope,'value','private',true);
  check(as3GetLexicalMember(Owner,slot)===null);
  const initialize=getAS3LexicalReferenceConstantInitializer(Owner,slot),value=[1];initialize(value);
  check(as3GetLexicalMember(Owner,slot)===value);value[0]=2;check((as3GetLexicalMember(Owner,slot) as any)[0]===2);
  reject(()=>as3SetLexicalMember(Owner,slot,[]),1074);
  reject(()=>initialize([]));reject(()=>getAS3LexicalReferenceConstantInitializer(Owner,slot)([]));
  reject(()=>getAS3LexicalClassConstantInitializer(Owner,slot));
  reject(()=>getAS3LexicalReferenceConstantInitializer(Owner,{} as any));
  const OtherOwner=publish('constantguard::Other');reject(()=>getAS3LexicalReferenceConstantInitializer(OtherOwner,slot));
  const nilScope=registerAS3LexicalMembers(OtherOwner,null,[member]),nullable=resolveAS3LexicalMember(nilScope,'value','private',true);
  const initNull=getAS3LexicalReferenceConstantInitializer(OtherOwner,nullable);initNull(null);reject(()=>initNull([]));
  for(const [index,change]of [{value:[]},{value:undefined},{static:false},{visibility:'protected'}].entries())
   reject(()=>registerAS3LexicalMembers(publish('constantguard::Invalid'+index),null,[{...member,...change} as any]));
  const PointOwner=publish('constantguard::PointOwner'),pointMember={...member,type:{name:'flash.geom::Point',reference:Point}};
  const pointScope=registerAS3LexicalMembers(PointOwner,null,[pointMember]),pointSlot=resolveAS3LexicalMember(pointScope,'value','private',true),initPoint=getAS3LexicalReferenceConstantInitializer(PointOwner,pointSlot);
  reject(()=>initPoint({x:1,y:2}),1034);check(as3GetLexicalMember(PointOwner,pointSlot)===null);
  const point=new Point(1,2);initPoint(point);check(as3GetLexicalMember(PointOwner,pointSlot)===point);point.x=7;check((as3GetLexicalMember(PointOwner,pointSlot) as Point).x===7);
  reject(()=>initPoint(new Point()));reject(()=>as3SetLexicalMember(PointOwner,pointSlot,new Point()),1074);
  const sibling=await session.load('sibling',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Log=sibling.getDefinition('cases.Log') as any;check(Log.classes.length===0);Log.fail=false;
  const Other=sibling.getDefinition('cases.Box') as any,other=Other.state();check(Subject!==Other);check(initial[0]!==other[0]);check(initial[2]!==other[2]);check(other[0].length===0);
  const child=await session.load('child',new ApplicationDomain(domain.applicationDomain));
  check(child.getDefinition('cases.Box')===Subject);
  return {rows:result.observations,checks:Array.from({length:checks},(_,i)=>({name:String(i),passed:true}))};
 }finally{session.retire();}
}
