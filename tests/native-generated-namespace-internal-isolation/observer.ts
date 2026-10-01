import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 const loaded=await session.load('namespace-internal',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Format:any=loaded.getDefinition('model.Format'),Reader:any=loaded.getDefinition('consumer.Reader'),Peer:any=loaded.getDefinition('model.Peer');
 const target=new Format(),reader=new Reader(),peer=new Peer(),rows:any[]=[];
 rows.push({id:'cross-package',value:reader.read(target)});
 rows.push({id:'same-package',value:peer.read(target)});
 rows.push({id:'internal-access',value:peer.internalRead(target)});
 const closure=reader.capture(target);
 rows.push({id:'captured',value:closure()});
 rows.push({id:'write',value:reader.write(target)});
 rows.push({id:'capture-after-write',value:closure.call({value:99})});
 rows.push({id:'peer-after-write',value:peer.read(target)});
 session.retire();return rows;
}
