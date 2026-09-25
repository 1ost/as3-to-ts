// Observation-only host for the complete maintained GameConfig source.
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {describeRegisteredFlashType} from '@FLASH@/utils/FlashTypeMetadata';
import {as3IsSourceErrorInstance} from '@FLASH@/errors/AS3SourceError';
export async function run(parentModule:NativeSourceClassModule,childModule:NativeSourceClassModule){
 const checks:string[]=[],check=(id:string,ok:boolean)=>{if(!ok)throw Error(id);checks.push(id);};
 const name='cn.kyiax.game.config.GameConfig',root=ApplicationDomain.currentDomain,parentDomain=new ApplicationDomain(root);
 const parentSession=createNativeSourceClassLoadingSession({resolve:()=>parentModule,maxModules:2});
 const parent=await parentSession.load('parent',parentDomain),GameConfig:any=parent.getDefinition(name);
 const call=(receiver:any,name:string,...args:any[])=>as3CallValue(get(receiver,name),()=>args);
 const reflected=describeRegisteredFlashType(GameConfig)!,constants=reflected.constants!.slice().sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
 const arrays=constants.filter(c=>c.type==='Array').map(c=>c.name);
 const rows:any[]=[{id:'declarations',value:constants.map(c=>c.name)}],row=(id:string,value:any)=>rows.push({id,value});
 // Snapshot copies belong to the observation host, not GameConfig's source API.
 for(const c of constants){const value:any=get(GameConfig,c.name);row('constant/'+c.name,Array.isArray(value)?Array.from(value):value);}
 for(const name of arrays){
  const a:any=get(GameConfig,name),old=get(a,'0'),count=get(a,'length');
  row('array-identity/'+name,[a===get(GameConfig,name),call(GameConfig,'hasOwnProperty',name),call(GameConfig,'propertyIsEnumerable',name)]);
  set(a,'0','changed');call(a,'push',99);as3ConstructClass(GameConfig,[]);
  row('array-mutation/'+name,[get(get(GameConfig,name),'0'),get(get(GameConfig,name),'length'),get(get(GameConfig,name),count),get(GameConfig,name)===a]);
  // Restore the observation host's temporary append without requiring a source
  // Array.pop provider: GameConfig itself contains no pop/concat invocation.
  set(a,'length',count);set(a,'0',old);
  let failure:any[]=[];try{set(GameConfig,name,[]);}catch(e){if(!as3IsSourceErrorInstance(e))throw e;failure=[(e as any).name,(e as any).errorID];}
  row('array-readonly/'+name,[failure,get(GameConfig,name)===a,Array.from(a)]);
 }
 const session=createNativeSourceClassLoadingSession({resolve:()=>childModule,maxModules:1});
 const domain=new ApplicationDomain(parentDomain),child=await session.load('child',domain);
 check('selected constants class reused',child.getDefinition(name)===GameConfig);
 check('inherited class is not republished locally',domain.getQualifiedDefinitionNames().length===0);
 check('source final class preserved',reflected.isFinal);
 check('inherited arrays retain identity',arrays.every(n=>get(child.getDefinition(name),n)===get(GameConfig,n)));
 const sibling=await parentSession.load('sibling',new ApplicationDomain(root)),Other=sibling.getDefinition(name);
 check('sibling Class is distinct',Other!==GameConfig);
 check('sibling arrays are fresh',arrays.every(n=>get(Other,n)!==get(GameConfig,n)));
 const a:any=get(GameConfig,arrays[0]),other:any=get(Other,arrays[0]),old=get(a,'0');set(a,'0','parent-only');
 check('sibling array unaffected',get(other,'0')===old);set(a,'0',old);
 session.retire();await session.whenIdle();check('parent survives child retirement',parentDomain.getDefinition(name)===GameConfig);
 parentSession.retire();await parentSession.whenIdle();check('retained constants survive retirement',get(GameConfig,arrays[0])===a&&!parentDomain.hasDefinition(name));
 return {rows,checks};
}
