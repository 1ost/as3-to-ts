import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 const loaded=await session.load('descendant-private',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Base:any=loaded.getDefinition('model.Base'),Child:any=loaded.getDefinition('model.Child'),Grand:any=loaded.getDefinition('model.Grandchild');
 const base=new Base(),child=new Child(),grand=new Grand(),rows:any[]=[];
 rows.push({id:'read-child',value:base.read(child)});
 rows.push({id:'read-grandchild',value:base.readGrand(grand)});
 rows.push({id:'child-private-namesake',value:child.childValue()});
 const captured=base.capture(child);rows.push({id:'captured',value:captured.call(null)});
 rows.push({id:'write-update',value:base.write(child,30)});
 rows.push({id:'after-write',value:base.read(child)});
 rows.push({id:'capture-after-write',value:captured.call(grand)});
 rows.push({id:'namesake-after-write',value:child.childValue()});
 rows.push({id:'other-instance',value:base.readGrand(grand)});
 let error='none';try{base.read(null);}catch(e){error=e.name+':'+e.errorID;}
 rows.push({id:'null-read',value:error});
 error='none';try{base.write(null,2);}catch(e){error=e.name+':'+e.errorID;}
 rows.push({id:'null-write',value:error});session.retire();return rows;
}
