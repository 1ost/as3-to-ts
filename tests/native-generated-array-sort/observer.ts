import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3Is} from '@FLASH@/utils/AS3Type';
export async function run(module){
 const load=async domain=>{const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('proxy',domain);return domain;};
 const domain=await load(new ApplicationDomain(ApplicationDomain.currentDomain)),Store=domain.getDefinition('ArraySortBridgeProbe');
 const Probe=domain.getDefinition('ArraySortBridgeProbe'),probe=as3ConstructClass(Probe,[]);
 const snapshot=as3CallValue(get(probe,'snapshot'),()=>[]);
 if(get(snapshot,'ready')!==true||get(snapshot,'failure')!=='')throw Error('snapshot failed');
 const rows=get(snapshot,'observations');
 const sibling=await load(new ApplicationDomain(ApplicationDomain.currentDomain)),Other=sibling.getDefinition('ArraySortBridgeProbe'),other=as3ConstructClass(Other,[]);
 const domainChecks=[Other!==Store,as3Is(probe,Store),!as3Is(other,Store),as3Is(other,Other)];
 if(domainChecks.some(v=>!v))throw Error('domain mismatch');
 return {rows,domainChecks};
}
