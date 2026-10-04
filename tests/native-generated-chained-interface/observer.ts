import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('chain-interface',domain);
 const make=name=>as3ConstructClass(domain.getDefinition('chainiface.'+name),[]),r=make('Reader'),c=make('Config'),h=make('Holder'),child=make('InheritedHolder');
 const call=(name,...args)=>as3CallValue(get(r,name),()=>args);
 const rows=[],observe=(id,fn)=>{try{rows.push({id,value:fn()});}catch(e){rows.push({id,value:[e.name,e.errorID]});}};
 set(h,'config',c);set(child,'config',c);set(c,'nestedValue',c);
 observe('plain-true',()=>[call('plain',h),get(h,'reads'),get(c,'reads'),get(r,'ownReads')]);
 set(c,'value',false);observe('plain-false',()=>[call('plain',h),get(h,'reads'),get(c,'reads'),get(r,'ownReads')]);
 set(c,'value',true);observe('inherited',()=>[call('inherited',child),get(child,'reads'),get(c,'reads'),get(r,'ownReads')]);
 observe('nested',()=>[call('nested',h),get(h,'reads'),get(c,'nestedReads'),get(c,'reads'),get(r,'ownReads')]);
 observe('own',()=>[call('own'),get(r,'ownReads')]);
 observe('twice-true',()=>[call('twice',h),get(h,'reads'),get(c,'reads'),get(r,'ownReads')]);
 set(c,'value',false);observe('twice-false',()=>[call('twice',h),get(h,'reads'),get(c,'reads'),get(r,'ownReads')]);
 observe('null-root',()=>call('plain',null));
 set(h,'config',null);observe('null-config',()=>call('plain',h));
 set(h,'config',c);set(c,'nestedValue',null);observe('null-nested',()=>call('nested',h));
 observe('invalid-field',()=>{try{set(h,'config',{});}catch(e){return [e.name,e.errorID,get(h,'config')===c];}return null;});
 set(c,'value',true);observe('direct',()=>[call('direct',c),get(h,'reads'),get(c,'nestedReads'),get(c,'reads'),get(r,'ownReads')]);
 observe('direct-null',()=>call('direct',null));
 return {rows};
}
