import {FlashTweenRuntime} from '@ENGINE@/src/extensions/greensock/FlashTweenRuntime';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {as3CreateObjectLiteral} from '@FLASH@/utils/AS3Class';
import cases from './cases.json';
export async function run(module){
 const runtime=new FlashTweenRuntime(()=>0),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 try{
  const domain=await session.load('probe',new ApplicationDomain(ApplicationDomain.currentDomain));
  const Probe:any=domain.getDefinition('BezierMigration'),probe=new Probe(),rows=[];
  for(const c of cases){
   const o:any=as3CreateObjectLiteral([['x',c.start[0]],['y',c.start[1]],['alpha',0],['scaleX',0],['scaleY',0]]),calls=[];
   const t=probe.start(o,c.points,calls);
   for(const time of [0,.025,.1,.2,.3,.399999,.4]){
    t.renderLocal(time);rows.push({id:c.id+'-object-'+time,time,x:o.x,y:o.y,alpha:o.alpha,scaleX:o.scaleX,scaleY:o.scaleY,calls:calls.slice()});calls.length=0;
   }t.kill();
  }
  const order=[],target={x:0,y:0,alpha:0,scaleX:0,scaleY:0};
  const t=probe.ordered(()=>{order.push('target');return target;},()=>{order.push('duration');return .4;},name=>{order.push(name);return name==='bezier'?[{x:1,y:2}]:1;});t.kill();
  if(order.join(',')!=='target,duration,alpha,bezier,scaleX,scaleY')throw Error('Source values must evaluate once in order');
  return {rows,order};
 }finally{session.retire();runtime.dispose();}
}
