import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3CallProperty} from '@FLASH@/utils/AS3Property';
export async function run(module:any){
 const load=()=>createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1}).load('regex-split',new ApplicationDomain(ApplicationDomain.currentDomain));
 const domain=await load(),Type=domain.getDefinition('regexsplit.Subject');
 const rows:any[]=[],values=['','one','a\nb','a\r\nb','a\n','a b\u00a0c','a,,b,','a\uD83D\uDE00b',null,undefined];
 for(let i=0;i<values.length;i++)for(const mode of ['lines','words','commas']){
  try{rows.push({id:i+'-'+mode,value:as3CallProperty(Type,mode,()=>[values[i]])});}
  catch(e:any){rows.push({id:i+'-'+mode,error:[e.name,e.errorID]});}
 }
 const other=await load(),Other=other.getDefinition('regexsplit.Subject');
 const domainChecks=[Other!==Type,Other.prototype!==Type.prototype];
 if(domainChecks.some(v=>!v))throw Error('isolated split');return {rows,domainChecks};
}
