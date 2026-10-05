import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('inherited-static',domain);
 const make=(name,...args)=>as3ConstructClass(domain.getDefinition(name.includes('.')?name:'staticfields.'+name),args);
 const invoke=(object,name,...args)=>as3CallValue(get(object,name),()=>args);
 const rows=[],record=(id,value)=>rows.push({id,value});
 const base=make('Base'),child=make('Child'),grand=make('far.Grand'),hidden=invoke(make('Factory'),'make');
 record('initial',[invoke(base,'readBase'),invoke(child,'read'),invoke(grand,'readDeep'),invoke(hidden,'readHidden'),invoke(base,'cellBase')===null,invoke(hidden,'cellHidden')===null]);
 const targets=[base,child,grand,hidden],writes=['writeBase','write','writeDeep','writeHidden'],saves=['saveBase','save','saveDeep','saveHidden'],values=[-3.9,4294967297,NaN,Infinity];
 let raw,cell;
 for(let i=0;i<4;i++){
  raw=invoke(targets[i],writes[i],values[i]);
  record('write:'+i,[Number.isNaN(values[i])?Number.isNaN(raw):raw===values[i],invoke(base,'readBase'),invoke(child,'read'),invoke(grand,'readDeep'),invoke(hidden,'readHidden')]);
  cell=make('Cell',i+10);raw=invoke(targets[i],saves[i],cell);
  record('reference:'+i,[raw===cell,invoke(base,'cellBase')===cell,invoke(child,'cell')===cell,invoke(grand,'cellDeep')===cell,invoke(hidden,'cellHidden')===cell]);
 }
 const events=[],convert={valueOf(){events.push('convert');return 12.8;}};
 raw=invoke(hidden,'writeHidden',convert);record('coercion',[raw===convert,events.slice(),invoke(base,'readBase'),invoke(grand,'readDeep')]);
 try{invoke(grand,'saveDeep',{});record('invalid-reference','missing error');}catch(e){record('invalid-reference',[e.name,e.errorID,invoke(base,'cellBase')===cell,invoke(hidden,'cellHidden')===cell]);}
 raw=invoke(hidden,'saveHidden',undefined);record('undefined-reference',[raw===undefined,invoke(base,'cellBase')===null,invoke(child,'cell')===null]);
 invoke(base,'writeBase',31);record('late-instance',[invoke(make('Child'),'read'),invoke(make('far.Grand'),'readDeep'),invoke(invoke(make('Factory'),'make'),'readHidden')]);
 try{get(hidden,'count');record('hidden-access','missing error');}catch(e){record('hidden-access',[e.name,e.errorID]);}
 return {rows};
}
