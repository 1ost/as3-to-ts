import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {Rectangle} from '@FLASH@/utils/AS3CanonicalRectangleReference';
import {Point} from '@FLASH@/geom/Point';
import {Matrix} from '@FLASH@/geom/Matrix';
import {AS3Error} from '@FLASH@/errors/AS3SourceError';
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
 const domain=await session.load('returns',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Subject=domain.getDefinition('rectreturn.Subject') as any,subject=new Subject();
 const rows:any[]=[];let conversions=0;
 const line=new Rectangle(1,2,3,4);
 const fake={toString(){conversions++;return 'line';},valueOf(){conversions++;return line;}};
 const samples=[null,undefined,line,new Point(),new Matrix(),{},{x:1,y:2,width:3,height:4},fake,3,'line',Rectangle,Rectangle.prototype];
 const names=['direct','protectedBridge','privateBridge','viaFinally','staticLine','line'];
 for(const name of names)for(let i=0;i<samples.length;i++){
  subject.effects=0;subject.value=samples[i];
  try{const result=name==='staticLine'?Subject.staticLine(samples[i]):name==='line'?subject.line:subject[name](samples[i]);rows.push({id:name+':'+i,value:[result===null,result===samples[i],subject.effects]});}
  catch(e:any){rows.push({id:name+':'+i,value:[e.name,e.errorID,subject.effects]});}
 }
 const cases:any[]=[['optional',[]],['direct',[]],['direct',[line,line]],['fallthrough',[false,line]],['fallthrough',[true,line]],['replaceFinally',[{},line]],['replaceFinally',[line,{}]],['fromCall',[()=>line]],['fromCall',[()=>({})]],['throwing',[new AS3Error('probe')]]];
 cases.forEach(([name,args],i)=>{subject.effects=0;try{const result=subject[name].apply(subject,args);rows.push({id:'case:'+i,value:[result===null,result===line,subject.effects]});}catch(e:any){rows.push({id:'case:'+i,value:[e.name,e.errorID,subject.effects]});}});
 rows.push({id:'conversions',value:conversions});
 const horizontal=subject.bounds(false),vertical=subject.bounds(true);
 rows.push({id:'created-horizontal',value:[horizontal.x,horizontal.y,horizontal.width,horizontal.height,horizontal instanceof Rectangle]});
 rows.push({id:'created-vertical',value:[vertical.x,vertical.y,vertical.width,vertical.height,vertical instanceof Rectangle]});
 rows.push({id:'created-fresh',value:[horizontal!==vertical,subject.bounds(false)!==horizontal]});
 let hostGuards=0,hostFailures=0;
 for(const value of [Object.create(Rectangle.prototype),new Proxy(line,{}),Object.assign({},line)]){
  subject.effects=0;try{subject.direct(value);throw Error('Forged Rectangle accepted');}catch(e:any){if(e.errorID===1034)hostGuards++;else hostFailures++;}
  if(subject.effects!==1)hostFailures++;
 }
 session.retire();return {rows,hostGuards,hostFailures};
}
