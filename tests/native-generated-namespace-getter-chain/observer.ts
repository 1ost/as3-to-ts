import {as3GetProperty as get} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
export async function run(module:NativeSourceClassModule){const domain=new ApplicationDomain(ApplicationDomain.currentDomain);await createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1}).load('namespace-chain',domain);const Child=domain.getDefinition('client.Child');return as3CallValue(get(Child,'run'),()=>[],Child);}
