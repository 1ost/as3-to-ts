import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {AS3ClassType} from '@FLASH@/utils/AS3Class';
import {AS3Int,AS3Uint} from '@FLASH@/utils/AS3Type';
import '@ENGINE@/tests/nativeCanonicalSpriteClass/init-imports';
import {Laya} from '@ENGINE@/src/layaAir/Laya';
import {Sprite} from '@FLASH@/display/Sprite';
export async function run(module:NativeSourceClassModule){
 await Laya.init(320,240);
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const domain=await session.load('constructors',new ApplicationDomain(ApplicationDomain.currentDomain));
 const classes=['OptionalClass','RequiredClass','PublicClass'].map(n=>domain.getDefinition('classctors.'+n) as any);
 const rows:any[]=[];let conversions=0;
 const fake={toString(){conversions++;return 'event';}};
 const Item=domain.getDefinition('classctors.Item') as any,IMember=domain.getDefinition('classctors.IMember') as any;
 const samples=[null,undefined,Object,Array,String,Number,Boolean,Function,AS3Int,AS3Uint,AS3ClassType,Item,IMember,function(){},new Item(),{},fake,3,Item.prototype];

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
 const Forward=domain.getDefinition('classctors.ForwardClass') as any,Required=classes[1];
 [Item,function(){},null,undefined].forEach((value,i)=>{
  Required.bodies=0;Forward.entered=0;
  try{const item=new Forward(value);rows.push({id:'forward:'+i,value:[item.saved===null,item.saved===value,Forward.entered,Required.bodies]});}
  catch(e:any){rows.push({id:'forward:'+i,value:[e.name,e.errorID,Forward.entered,Required.bodies]});}
 });
 Required.bodies=0;Forward.entered=0;
 try{new Forward();rows.push({id:'forward:omitted',value:['accepted',Forward.entered,Required.bodies]});}
 catch(e:any){rows.push({id:'forward:omitted',value:[e.name,e.errorID,Forward.entered,Required.bodies]});}
 samples.forEach((value,i)=>{
  const slot=new classes[2](null);
  try{slot.replace(value);rows.push({id:'write:'+i,value:[slot.saved===null,slot.saved===value]});}
  catch(e:any){rows.push({id:'write:'+i,value:[e.name,e.errorID,slot.saved===null]});}
 });
 rows.push({id:'conversions',value:conversions});
 let guards=0;
 for(const Kind of classes)for(const forged of [Object.assign(function(){},{prototype:Item.prototype}),new Proxy(Item,{}),Object.assign({},Item)]){
  Kind.bodies=0;try{new Kind(forged);throw Error('Forged Class accepted');}catch(e:any){if(e.errorID!==1034&&!(e instanceof TypeError&&e.message==='AS3_CLASS_UNSUPPORTED: native class lacks exact source metadata'))throw e;guards++;}
  if(Kind.bodies!==0)throw Error('Body entered before coercion');
 }
 session.retire();return{rows,guards};
}
