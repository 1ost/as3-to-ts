import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {declareAS3ReferenceType} from '@FLASH@/utils/AS3DeclarationType';
import {registerAS3GeneratedClass} from '@FLASH@/utils/AS3GeneratedClass';
import {registerAS3LexicalMembers,resolveAS3LexicalMember,getAS3LexicalBooleanConstantInitializer,getAS3LexicalStringConstantInitializer,as3GetLexicalMember,as3SetLexicalMember} from '@FLASH@/utils/AS3LexicalMembers';
function providerChecks(){
 const checks:string[]=[];
 const check=(name:string,action:()=>void,pattern:RegExp)=>{let caught=false;try{action();}catch(e:any){if(!pattern.test(String(e.message)))throw e;caught=true;}if(!caught)throw Error('missing rejection: '+name);checks.push(name);};
 const equal=(name:string,a:any,b:any)=>{if(a!==b)throw Error(name);checks.push(name);};
 const make=(name:string)=>{const C=function(){};Object.defineProperty(C,'prototype',{writable:false});const declaration=declareAS3ReferenceType(name);const empty=():{variables:never[];constants:never[];methods:never[];accessors:never[]}=>({variables:[],constants:[],methods:[],accessors:[]});registerAS3GeneratedClass(C,{metadata:{name,base:'Object',isDynamic:false,isFinal:false,instance:empty(),statics:empty()},instanceTraits:[],staticTraits:[],declaration});return C;};
 const member={name:'v',visibility:'private',static:true,kind:'constant',type:'Boolean'} as const;
 const C=make('checks::BooleanConstant'),scope=registerAS3LexicalMembers(C,null,[member]),access=resolveAS3LexicalMember(scope,'v','private',true),init=getAS3LexicalBooleanConstantInitializer(C,access);
 equal('default is false',as3GetLexicalMember(C,access),false);equal('source name is not native storage',Object.prototype.hasOwnProperty.call(C,'v'),false);
 check('readonly before initialization',()=>as3SetLexicalMember(C,access,true),/1074/);check('wrong initializer type',()=>getAS3LexicalStringConstantInitializer(C,access),/private static String/);
 init(0);equal('false conversion',as3GetLexicalMember(C,access),false);check('false publication is still one shot',()=>init(1),/uninitialized/);check('readonly after initialization',()=>as3SetLexicalMember(C,access,true),/1074/);
 check('unknown capability',()=>getAS3LexicalBooleanConstantInitializer(C,{} as any),/unknown lexical access/);check('wrong owner',()=>getAS3LexicalBooleanConstantInitializer(make('checks::Other'),access),/exact lexical constant generation/);
 const values=[null,undefined,NaN,0,-0,'',false,1,'false',{},[]],expected=[false,false,false,false,false,false,false,true,true,true,true];
 values.forEach((value,index)=>{const T=make('checks::Conversion'+index),s=registerAS3LexicalMembers(T,null,[member]),a=resolveAS3LexicalMember(s,'v','private',true);getAS3LexicalBooleanConstantInitializer(T,a)(value);equal('Boolean conversion '+index,as3GetLexicalMember(T,a),expected[index]);});
 const T=make('checks::Hooks'),s=registerAS3LexicalMembers(T,null,[member]),a=resolveAS3LexicalMember(s,'v','private',true);getAS3LexicalBooleanConstantInitializer(T,a)({valueOf(){throw Error('unexpected valueOf');},toString(){throw Error('unexpected toString');}});equal('Boolean object conversion does not invoke hooks',as3GetLexicalMember(T,a),true);
 [{value:undefined},{value:false},{value:true},{value:null},{static:false},{visibility:'protected'},{visibility:'internal'}].forEach((change,index)=>check('malformed trait '+index,()=>registerAS3LexicalMembers(make('checks::Invalid'+index),null,[{...member,...change} as any]),/AS3_LEXICAL_UNSUPPORTED/));
 return checks;
}
export async function run(module:NativeSourceClassModule){
 (globalThis as any).providerChecks=providerChecks();
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('booleans',domain);
 const Trace=domain.getDefinition('boolconst.Trace'),holder=():any=>domain.getDefinition('boolconst.Holder'),arr=(name:string):any=>get(Trace,name),item=(name:string,i:number):any=>get(arr(name),i),len=(name:string)=>get(arr(name),'length') as number,rows:any[]=[],row=(id:string,value:any)=>rows.push({id,value});
 const invoke=(object:any,name:any,...args:any[])=>as3CallValue(get(object,name),()=>args),snapshot=()=>Array.from({length:len('log')},(_,i)=>item('log',i));
 row('before',len('log'));try{holder();row('first','accepted');}catch(e){if(e!==get(Trace,'failure'))throw e;row('first',[e===get(Trace,'failure'),len('classes')]);}
 const failed=item('classes',0);row('failed',invoke(failed,'read'));set(Trace,'fail',false);const selected=holder();
 row('retry',[len('classes'),failed===selected,invoke(selected,'read'),invoke(failed,'read')]);row('order',snapshot());row('once',[holder()===selected,len('log'),invoke(selected,'read')]);
 set(selected,'active',false);row('disabled',[get(selected,'active'),get(failed,'active')]);set(selected,'active',true);row('enabled',[get(selected,'active'),get(failed,'active')]);
 session.retire();return rows;
}
