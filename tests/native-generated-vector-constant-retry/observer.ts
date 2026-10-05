import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3VectorCreate,as3VectorPrimitiveSpec} from '@FLASH@/utils/AS3Vector';
import {QName} from '@FLASH@/utils/QName';
import {declareAS3ReferenceType} from '@FLASH@/utils/AS3DeclarationType';
import {declareAS3GeneratedStaticConstant,registerAS3GeneratedClass} from '@FLASH@/utils/AS3GeneratedClass';
import {registerAS3LexicalMembers,resolveAS3LexicalMember,getAS3LexicalVectorConstantInitializer,as3GetLexicalMember,as3SetLexicalMember} from '@FLASH@/utils/AS3LexicalMembers';
function providerChecks(){
 const checks:string[]=[],spec=as3VectorPrimitiveSpec('int'),type={name:'__AS3__.vec::Vector.<int>',vector:spec};
 const check=(name:string,action:()=>void,pattern:RegExp)=>{let caught=false;try{action();}catch(e:any){if(!pattern.test(String(e.message)))throw e;caught=true;}if(!caught)throw Error('missing rejection: '+name);checks.push(name);};
 const equal=(name:string,a:any,b:any)=>{if(a!==b)throw Error(name);checks.push(name);};
 check('forged specialization',()=>declareAS3GeneratedStaticConstant(function(){},'v',{name:type.name,vector:{} as any}),/specialization/);
 check('incorrect Vector name',()=>declareAS3GeneratedStaticConstant(function(){},'v',{name:'Vector.fake',vector:spec}),/name/);
 const make=(name:string,publicSlot=false)=>{
  const C=function(){};Object.defineProperty(C,'prototype',{writable:false});const declaration=declareAS3ReferenceType(name);
  const initialize=publicSlot?declareAS3GeneratedStaticConstant(C,'v',type):undefined;
  registerAS3GeneratedClass(C,{metadata:{name,base:'Object',isDynamic:false,isFinal:false,instance:{variables:[],constants:[],methods:[],accessors:[]},statics:{variables:[],constants:publicSlot?[{name:'v',declaredBy:name,type:type.name}]:[],methods:[],accessors:[]}},instanceTraits:[],staticTraits:publicSlot?[{name:'v',kind:'constant',type}]:[],declaration});return {C,initialize};
 };
 const pub=make('checks::PublicVector',true),value=as3VectorCreate(spec);
 check('public failed coercion',()=>pub.initialize!(as3VectorCreate(as3VectorPrimitiveSpec('uint'))),/1034/);equal('public failure retains null',get(pub.C,'v'),null);pub.initialize!(value);equal('public identity',get(pub.C,'v'),value);check('public initialized once',()=>pub.initialize!(value),/uninitialized/);
 const {C}=make('checks::PrivateVector');const scope=registerAS3LexicalMembers(C,null,[{name:'v',visibility:'private',static:true,kind:'constant',type}]),access=resolveAS3LexicalMember(scope,'v','private',true),init=getAS3LexicalVectorConstantInitializer(C,access);
 check('lexical failed coercion',()=>init({}),/1034/);equal('lexical failure retains null',as3GetLexicalMember(C,access),null);init(value);equal('lexical identity',as3GetLexicalMember(C,access),value);check('lexical initialized once',()=>init(value),/uninitialized/);check('lexical readonly',()=>as3SetLexicalMember(C,access,null),/1074/);check('unknown capability',()=>getAS3LexicalVectorConstantInitializer(C,{} as any),/unknown lexical access/);
 const other=make('checks::OtherVector');check('wrong owner',()=>getAS3LexicalVectorConstantInitializer(other.C,access),/exact lexical constant generation/);
 return checks;
}
export async function run(module:NativeSourceClassModule){
 (globalThis as any).providerChecks=providerChecks();
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('vectors',domain);
 const Trace=domain.getDefinition('vectorconst.Trace'),holder=():any=>domain.getDefinition('vectorconst.Holder'),arr=(name:string):any=>get(Trace,name),item=(name:string,i:number):any=>get(arr(name),i),len=(name:string)=>get(arr(name),'length') as number,rows:any[]=[],row=(id:string,value:any)=>rows.push({id,value}),words=new QName('urn:op2:vector-constant','words');
 const invoke=(object:any,name:any,...args:any[])=>as3CallValue(get(object,name),()=>args),snapshot=()=>Array.from({length:len('log')},(_,i)=>item('log',i));
 row('before',len('log'));try{holder();row('first','accepted');}catch(e){if(e!==get(Trace,'failure'))throw e;row('first',[e===get(Trace,'failure'),len('classes')]);}
 const failed=item('classes',0),old:any=get(failed,'numbers');
 row('failed-state',[get(failed,'empty')===null,old.length,old[0],old[1],old[2],get(failed,'current')===old,(get(failed,words) as any)[0],(get(failed,words) as any)[1],invoke(failed,'render',4),(invoke(failed,'readHidden') as any)[0]]);
 set(Trace,'fail',false);const selected=holder();
 row('retry',[len('classes'),failed===selected,old===get(selected,'numbers'),get(failed,words)===get(selected,words),invoke(failed,'readHidden')===invoke(selected,'readHidden')]);row('order',snapshot());row('once',[holder()===selected,len('log'),invoke(selected,'render',5)]);
 const numbers:any=get(selected,'numbers');row('element-write',[invoke(selected,'write',1,4294967298),numbers[1],old[1]]);row('grow',[numbers.push(9),numbers.length,old.length]);numbers.fixed=true;
 try{numbers.push(10);}catch(e:any){row('fixed',[e.name,e.errorID,numbers.length]);}
 try{set(selected,'numbers',null);}catch(e:any){row('readonly-public',[e.name,e.errorID,get(selected,'current')===numbers]);}
 try{set(selected,words,null);}catch(e:any){row('readonly-namespace',[e.name,e.errorID,(get(selected,words) as any)[2]]);}
 const inputs=[numbers,null,undefined,as3VectorCreate(as3VectorPrimitiveSpec('uint')),[],{}];
 for(let i=0;i<inputs.length;i++){invoke(selected,'assign',numbers);try{const result=invoke(selected,'assign',inputs[i]);row('assign-'+i,['ok',result===inputs[i],get(selected,'current')===inputs[i],get(selected,'current')===null]);}catch(e:any){row('assign-'+i,[e.name,e.errorID,get(selected,'current')===numbers]);}}
 session.retire();return rows;
}