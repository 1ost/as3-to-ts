import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {Matrix} from '@FLASH@/utils/AS3CanonicalMatrixReference';
import {Rectangle} from '@FLASH@/geom/Rectangle';
import {Point} from '@FLASH@/geom/Point';
import '@ENGINE@/tests/nativeCanonicalSpriteClass/init-imports';
import {Laya} from '@ENGINE@/src/layaAir/Laya';
import {Sprite} from '@FLASH@/display/Sprite';
import {MovieClip} from '@FLASH@/display/MovieClip';
import {Shape} from '@FLASH@/display/Shape';
import {DisplayObjectContainer} from '@FLASH@/display/DisplayObjectContainer';
export async function run(module:NativeSourceClassModule){
 await Laya.init(320,240);
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const domain=await session.load('constructors',new ApplicationDomain(ApplicationDomain.currentDomain));
 const classes=['OptionalMatrix','RequiredMatrix'].map(n=>domain.getDefinition('matrixctors.'+n) as any);
 const rows:any[]=[];let conversions=0;
 const fake={toString(){conversions++;return '<fake/>';}};
 const samples=[null,undefined,new Matrix(),new Matrix(1,2,3,4,5,6),new Point(),new Rectangle(),{},{a:1,b:0,c:0,d:1,tx:0,ty:0},fake,3,'matrix',Matrix.prototype];
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
 for(const Kind of classes)for(const forged of [Object.create(Matrix.prototype)]){
  Kind.bodies=0;try{new Kind(forged);throw Error('Forged Matrix accepted');}catch(e:any){if(e.errorID!==1034)throw e;guards++;}
  if(Kind.bodies!==0)throw Error('Body entered before coercion');
 }
 const Float=domain.getDefinition('flashx.textLayout.compose.FloatCompositionData') as any;
 const graphic=new Sprite(),parent=new Sprite(),matrix=new Matrix(1,2,3,4,5,6);
 const observeFloat=(id:string,value:any,owner:any)=>{try{const item=new Float(1,graphic,'left',2,3,0.5,value,4,5,6,owner);rows.push({id,value:[item.absolutePosition,item.graphic===graphic,item.floatType,item.x,item.y,item.alpha,item.matrix===value,item.matrix===null,item.depth,item.knockOutWidth,item.columnIndex,item.parent===owner,item.parent===null]});}catch(e:any){rows.push({id,value:[e.name,e.errorID]});}};
 [matrix,new Point(),null,undefined,{}].forEach((v,i)=>observeFloat('float-matrix:'+i,v,parent));
 [null,undefined,parent,new MovieClip(),new Shape(),{}].forEach((v,i)=>observeFloat('float-parent:'+i,matrix,v));
 try{new Float(1,graphic,'left',2,3,0.5,matrix,4,5,6,Object.create(DisplayObjectContainer.prototype));throw Error('Forged container accepted');}catch(e:any){if(e.errorID!==1034)throw e;guards++;}
 session.retire();return {rows,guards};
}
