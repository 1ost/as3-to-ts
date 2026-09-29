import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {Rectangle} from '@FLASH@/utils/AS3CanonicalRectangleReference';
import {Point} from '@FLASH@/geom/Point';
import {Matrix} from '@FLASH@/geom/Matrix';
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const domain=await session.load('constructors',new ApplicationDomain(ApplicationDomain.currentDomain));
 const classes=['OptionalRectangle','RequiredRectangle'].map(n=>domain.getDefinition('rectctors.'+n) as any);
 const rows:any[]=[];let conversions=0;
 const fake={toString(){conversions++;return '<fake/>';}};
 const samples=[null,undefined,new Rectangle(),new Rectangle(1,2,3,4),new Point(),new Matrix(),{},{x:1,y:2,width:3,height:4},fake,3,'rectangle',Rectangle.prototype];
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
 rows.push({id:'conversions',value:conversions});
 let guards=0;
 for(const Kind of classes)for(const forged of [Object.create(Rectangle.prototype)]){
  Kind.bodies=0;try{new Kind(forged);throw Error('Forged Rectangle accepted');}catch(e:any){if(e.errorID!==1034)throw e;guards++;}
  if(Kind.bodies!==0)throw Error('Body entered before coercion');
 }
 session.retire();return {rows,guards};
}
