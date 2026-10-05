import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {Rectangle} from '@FLASH@/utils/AS3CanonicalRectangleReference';
import {Point} from '@FLASH@/geom/Point';
import {Matrix} from '@FLASH@/geom/Matrix';
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const domain=await session.load('rectangle-types',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Subject=domain.getDefinition('recttypes.Subject') as any,subject=new Subject();
 const rows:any[]=[];let conversions=0;const line=new Rectangle(1,2,3,4);
 const fake={toString(){conversions++;return 'line';},valueOf(){conversions++;return line;}};
 const samples=[null,undefined,line,new Point(),new Matrix(),{},{x:1,y:2,width:3,height:4},fake,3,'line',Rectangle,Rectangle.prototype];
 for(const method of ['directAs','directIs','indexedAs','indexedIs'])for(let i=0;i<samples.length;i++){
  subject.index=0;const indexed=method.startsWith('indexed'),result=subject[method](indexed?[samples[i],{}]:samples[i]);
  rows.push({id:method+':'+i,value:method.endsWith('Is')?[result,subject.index]:[result===null,result===samples[i],subject.index]});
 }
 rows.push({id:'conversions',value:conversions});let hostGuards=0,hostFailures=0,traps=0;
 const trapped=new Proxy({},{get(){traps++;throw Error('trap');},getPrototypeOf(){traps++;throw Error('trap');}});
 for(const value of [Object.create(Rectangle.prototype),new Proxy(line,{}),Object.assign({},line),trapped]){
  subject.index=0;const a=subject.directAs(value),b=subject.directIs(value),c=subject.indexedAs([value]);
  if(a===null&&b===false&&c===null&&subject.index===1&&traps===0)hostGuards++;else hostFailures++;
 }
 session.retire();return {rows,hostGuards,hostFailures};
}
