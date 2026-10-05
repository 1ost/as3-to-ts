import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('inherited-static-array',domain);
 const make=(name,...args)=>as3ConstructClass(domain.getDefinition(name.includes('.')?name:'arrayfields.'+name),args),call=(object,name,...args)=>as3CallValue(get(object,name),()=>args);
 const rows=[],record=(id,value)=>rows.push({id,value}),b=make('Base'),c=make('Child'),g=make('arrayfar.Grand'),h=call(make('Factory'),'make');
 record('initial',[call(b,'base')===null,call(c,'peek')===null,call(g,'deep')===null,call(h,'hidden')===null]);
 const targets=[b,c,g,h],names=['putBase','put','putDeep','putHidden'];let a,raw;
 for(let i=0;i<4;i++){
  a=call(b,'fresh');raw=call(targets[i],names[i],a);
  record('assign:'+i,[raw===a,call(b,'base')===a,call(c,'peek')===a,call(g,'deep')===a,call(h,'hidden')===a]);
  set(a,'0',10+i);call(a,'push',99);
  record('mutate:'+i,[get(call(b,'base'),'0'),get(call(c,'peek'),'0'),get(call(g,'deep'),'0'),get(call(h,'hidden'),'0'),get(call(b,'base'),'length'),get(call(h,'hidden'),'length')]);
 }
 for(const [i,value]of [{},'bad',1].entries())try{call(g,'putDeep',value);record('invalid:'+i,'missing error');}catch(e){record('invalid:'+i,[e.name,e.errorID,call(b,'base')===a,call(h,'hidden')===a]);}
 raw=call(h,'putHidden',null);record('null',[raw===null,call(b,'base')===null,call(c,'peek')===null]);
 call(b,'putBase',a);raw=call(c,'put',undefined);record('undefined',[raw===undefined,call(b,'base')===null,call(h,'hidden')===null]);
 call(b,'putBase',a);record('late-instance',[call(make('Child'),'peek')===a,call(make('arrayfar.Grand'),'deep')===a,call(call(make('Factory'),'make'),'hidden')===a]);
 try{get(h,'values');record('protected','missing error');}catch(e){record('protected',[e.name,e.errorID]);}
 return {rows};
}
