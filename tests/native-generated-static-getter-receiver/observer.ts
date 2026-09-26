import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
export async function run(module:NativeSourceClassModule) {
    const session = createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:2});
    try {
        const domain = await session.load('probe',new ApplicationDomain(ApplicationDomain.currentDomain));
        const Probe = domain.getDefinition('StaticGetterReceiverProbe') as any;
        const result = new Probe().snapshot();
        if (!result.ready || result.failure) throw Error('Source snapshot failed');
        return {rows:result.observations};
    } finally {session.retire();}
}
