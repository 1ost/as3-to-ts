import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 const loaded=await session.load('negative-default',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Base:any=loaded.getDefinition('model.Base'),Child:any=loaded.getDefinition('model.Child');
 const base=new Base(),child=new Child(),rows:any[]=[];
 const row=(id:string,value:any)=>rows.push({id,value});
 row('constructor',[base.seed(),child.seed(),new Base(undefined).seed()]);
 row('omitted',base.range());row('partial',base.range(9));row('undefined',base.range(undefined,undefined));
 row('override',child.range());row('parent-omitted',child.parentRange());row('parent-undefined',child.parentUndefined());
 row('minimum',base.minimum());row('decimal',base.decimal());row('exponent',base.exponent());row('uint-zero',base.zero());
 const method=base.range;row('closure',[method(),method(2),method.length]);session.retire();return rows;
}
