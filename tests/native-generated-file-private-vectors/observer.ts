import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
export async function run(module:NativeSourceClassModule){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('private-vectors',domain);
 const invoke=(object:any,name:any,...args:any[])=>as3CallValue(get(object,name),()=>args,object),left=domain.getDefinition('left.LeftFactory'),right=domain.getDefinition('right.RightFactory'),rows:any[]=[],row=(id:string,value:any)=>rows.push({id,value});
 const a=invoke(left,'create'),b=invoke(left,'create'),c=invoke(right,'create'),snap=(o:any):any=>invoke(o,'snapshot');
 row('empty',[invoke(a,'count'),invoke(b,'count'),invoke(c,'count'),snap(a)===snap(b)]);
 invoke(a,'add',7);invoke(a,'add',9);invoke(c,'add',11);
 row('values',[invoke(a,'count'),invoke(a,'at',0),invoke(a,'at',1),invoke(b,'count'),invoke(c,'at',0)]);
 row('identity',[invoke(a,'convert',snap(a))===snap(a),invoke(b,'convert',snap(a))===snap(a)]);
 let v:any=invoke(a,'convert',[snap(a)[0],null]);row('array',[v.length,v[0]===snap(a)[0],v[1]===null]);
 try{invoke(a,'convert',snap(c));}catch(e:any){row('foreign-vector',[e.name,e.errorID]);}
 try{invoke(a,'convert',[snap(c)[0]]);}catch(e:any){row('foreign-item',[e.name,e.errorID]);}
 try{invoke(a,'assign',snap(c));}catch(e:any){row('foreign-assignment',[e.name,e.errorID,invoke(a,'at',0)]);}
 v=invoke(a,'sized',2,true);row('sized',[v.length,v.fixed,v[0]===null,v[1]===null]);
 try{v.push(snap(a)[0]);}catch(e:any){row('fixed',[e.name,e.errorID]);}
 const x:any=invoke(a,'classes'),y:any=invoke(b,'classes'),z:any=invoke(c,'classes');row('classes',[x.length,x[0]===y[0],x[1]===y[1],x[0]===z[0],x[1]===z[1]]);
 invoke(b,'assign',snap(a));invoke(b,'add',13);row('shared',[invoke(a,'count'),invoke(a,'at',2),snap(b)===snap(a)]);session.retire();return rows;
}
