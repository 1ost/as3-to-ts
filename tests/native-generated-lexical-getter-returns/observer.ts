import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('lexical-getter-returns',domain);
 const make=name=>as3ConstructClass(domain.getDefinition(name.includes('.')?name:'getters.'+name),[]),call=(object,name,...args)=>as3CallValue(get(object,name),()=>args);
 const rows=[],record=(id,value)=>rows.push({id,value}),b=make('Base'),c=make('Child'),g=make('getterfar.Grand'),cell=make('Cell'),obj={x:1};
 for(const [i,item]of [b,c,g].entries()){
  set(item,'raw','6.5');set(item,'hits',0);record('number:'+i,[call(item,'readNumber'),call(item,'readVirtualNumber'),get(item,'hits')]);
  set(item,'raw',obj);set(item,'hits',0);record('object:'+i,[call(item,'readObject')===obj,call(item,'readVirtualObject')===obj,get(item,'hits')]);
  set(item,'raw',cell);set(item,'hits',0);record('cell:'+i,[call(item,'readCell')===cell,call(item,'readVirtualCell')===cell,get(item,'hits')]);
  set(item,'raw',undefined);set(item,'hits',0);record('undefined:'+i,[Number.isNaN(call(item,'readNumber')),call(item,'readObject')===null,call(item,'readCell')===null,call(item,'readVirtualObject')===null,call(item,'readVirtualCell')===null,get(item,'hits')]);
  set(item,'raw',null);set(item,'hits',0);record('null:'+i,[call(item,'readNumber'),call(item,'readObject')===null,call(item,'readCell')===null,get(item,'hits')]);
  set(item,'raw',{});set(item,'hits',0);
  for(const [id,name]of [['invalid-private:','readCell'],['invalid-protected:','readVirtualCell']])try{call(item,name);record(id+i,'missing error');}catch(e){record(id+i,[e.name,e.errorID,get(item,'hits')]);}
 }
 set(c,'raw',12);set(c,'hits',0);record('private-owner',[call(c,'readNumber'),call(c,'ownNumber'),call(b,'peer',c),get(c,'hits')]);
 for(const name of ['number','virtualNumber'])try{get(c,name);record('visibility:'+name,'missing error');}catch(e){record('visibility:'+name,[e.name,e.errorID]);}
 return {rows};
}
