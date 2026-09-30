import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {as3VectorPrimitiveSpec,as3VectorDeclarationSpec,as3VectorCreate,as3VectorFromValues} from '@FLASH@/utils/AS3Vector';
import {getAS3DeclarationType} from '@FLASH@/utils/AS3DeclarationType';
import '@ENGINE@/tests/nativeCanonicalSpriteClass/init-imports';
import {Laya} from '@ENGINE@/src/layaAir/Laya';
import {Sprite} from '@FLASH@/display/Sprite';
export async function run(module:NativeSourceClassModule){
 await Laya.init(320,240);
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const domain=await session.load('constructors',new ApplicationDomain(ApplicationDomain.currentDomain));
 const classes=['OptionalString', 'RequiredString', 'OptionalInt', 'OptionalObject', 'OptionalItem'].map(n=>domain.getDefinition('vectorctors.'+n) as any);
 const rows:any[]=[];let conversions=0;
 const fake={toString(){conversions++;return 'event';}};
 const spec=as3VectorPrimitiveSpec('String'),strings=as3VectorFromValues(spec,['one','two']),fixed=as3VectorCreate(spec,2,true);
 const Item=domain.getDefinition('vectorctors.Item') as any;
 const samples=[null,undefined,strings,fixed,...['int','uint','Number','Object','*'].map(n=>as3VectorCreate(as3VectorPrimitiveSpec(n))),[],{length:0},fake,3,String,String.prototype,strings.slice(),as3VectorCreate(as3VectorDeclarationSpec(getAS3DeclarationType(Item)))];

 classes.forEach((Kind,c)=>{
  Kind.bodies=0;
  try{const empty=new Kind();rows.push({id:'default:'+c,value:[empty.saved===null,Kind.bodies]});}
  catch(e:any){rows.push({id:'default:'+c,value:[e.name,e.errorID,Kind.bodies]});}
  samples.forEach((value,i)=>{Kind.bodies=0;
   try{const item=new Kind(value);rows.push({id:c+':'+i,value:[item.saved===null,item.saved===value,Kind.bodies]});}
   catch(e:any){rows.push({id:c+':'+i,value:[e.name,e.errorID,Kind.bodies]});}
  });
  Kind.bodies=0;
  try{new Kind(null,null);rows.push({id:'extra:'+c,value:['accepted',Kind.bodies]});}
  catch(e:any){rows.push({id:'extra:'+c,value:[e.name,e.errorID,Kind.bodies]});}
 });
 const Forward=domain.getDefinition('vectorctors.ForwardString') as any,Required=classes[1];
 [strings,as3VectorCreate(as3VectorPrimitiveSpec('int')),null,undefined].forEach((value,i)=>{
  Required.bodies=0;Forward.entered=0;
  try{const item=new Forward(value);rows.push({id:'forward:'+i,value:[item.saved===null,item.saved===value,Forward.entered,Required.bodies]});}
  catch(e:any){rows.push({id:'forward:'+i,value:[e.name,e.errorID,Forward.entered,Required.bodies]});}
 });
 Required.bodies=0;Forward.entered=0;
 try{new Forward();rows.push({id:'forward:omitted',value:['accepted',Forward.entered,Required.bodies]});}
 catch(e:any){rows.push({id:'forward:omitted',value:[e.name,e.errorID,Forward.entered,Required.bodies]});}
 rows.push({id:'conversions',value:conversions});
 let guards=0;
 for(const Kind of classes)for(const forged of [Object.create(Object.getPrototypeOf(strings)),new Proxy(strings,{}),Object.assign({},strings)]){
  Kind.bodies=0;try{new Kind(forged);throw Error('Forged vector accepted');}catch(e:any){if(e.errorID!==1034)throw e;guards++;}
  if(Kind.bodies!==0)throw Error('Body entered before coercion');
 }
 session.retire();return{rows,guards};
}
