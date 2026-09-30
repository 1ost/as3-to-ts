import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 try {const domain=await session.load('probe',new ApplicationDomain(ApplicationDomain.currentDomain)),OwnReceiver=domain.getDefinition('probe.OwnReceiver') as any,a=new OwnReceiver(),b=new OwnReceiver(),rows:any[]=[];
 const row=(id:string,value:any)=>rows.push({id,value});
 OwnReceiver.install(a);b.dispatch({amount:2});row('other-caller',a.total);row('selected-receiver',[a.total,b.total]);
 const first=b.callback(),second=a.callback();row('stable-closure',first===second);
 OwnReceiver.install(b);first({amount:3});row('retained-receiver',a.total);row('new-closure',b.callback()!==first);
 a.replacement=a;a.dispatch({amount:7});row('receiver-before-argument',b.total);row('state',[a.total,b.total]);
 a.replacement=null;OwnReceiver.install(null);let failure=0;try{a.dispatch({amount:1});}catch(error){failure=error.errorID;}row('null-error',failure);
 row('argument-evaluation',[a.evaluations.concat(),b.evaluations.concat()]);return {rows};
 } finally {session.retire();}
}
