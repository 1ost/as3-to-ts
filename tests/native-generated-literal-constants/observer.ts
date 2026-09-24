// Native host adapter. CacheName is emitted from its complete maintained AS3.
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty,as3SetProperty} from '@FLASH@/utils/AS3Property';
import {describeRegisteredFlashType} from '@FLASH@/utils/FlashTypeMetadata';
export async function run(parentModule:NativeSourceClassModule,childModule:NativeSourceClassModule){
 const checks:string[]=[],check=(id:string,ok:boolean)=>{if(!ok)throw Error(id);checks.push(id);};
 const name='cn.kyiax.game.config.CacheName',root=ApplicationDomain.currentDomain;
 const parentSession=createNativeSourceClassLoadingSession({resolve:()=>parentModule,maxModules:1});
 const parent=await parentSession.load('parent',root),CacheName=parent.getDefinition(name);
 const value=as3GetProperty(CacheName,'CFG_NAME');
 const session=createNativeSourceClassLoadingSession({resolve:()=>childModule,maxModules:2});
 const domain=new ApplicationDomain(root),child=await session.load('child',domain);
 check('selected constants class reused',child.getDefinition(name)===CacheName);
 check('inherited class is not republished locally',domain.getQualifiedDefinitionNames().length===0);
 const reflected=describeRegisteredFlashType(CacheName)!;
 check('source final class preserved',reflected.isFinal);
 let id=0;try{as3SetProperty(CacheName,'CFG_NAME','changed');}catch(e){id=(e as any).errorID;}
 check('constant remains immutable',id===1074&&as3GetProperty(CacheName,'CFG_NAME')===value);
 session.retire();check('parent survives child retirement',root.getDefinition(name)===CacheName);
 parentSession.retire();check('retained constants survive retirement',as3GetProperty(CacheName,'CFG_NAME')===value&&!root.hasDefinition(name));
 const constants=reflected.constants!.map(c=>[c.name,as3GetProperty(CacheName,c.name)]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
 return {rows:[{id:'cache-name',value}],checks,constants};
}
