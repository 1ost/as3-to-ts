import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
export async function run(parentModule:NativeSourceClassModule,childModule:NativeSourceClassModule){
 const checks:string[]=[],rows:any[]=[];
 const check=(id:string,value:boolean)=>{if(!value)throw Error(id);checks.push(id);};
 const row=(id:string,value:unknown)=>rows.push({id,value});
 const root=ApplicationDomain.currentDomain;
 const parentSession=createNativeSourceClassLoadingSession({resolve:()=>parentModule,maxModules:1});
 const parent=await parentSession.load('parent',root),Base=parent.getDefinition('superfields.Base');
 const session=createNativeSourceClassLoadingSession({resolve:()=>childModule,maxModules:2});
 const loaded=await session.load('child',new ApplicationDomain(root));
 const Child:any=loaded.getDefinition('superfields.Child'),Grandchild:any=loaded.getDefinition('superfields.Grandchild');
 const c=new Child(),g=new Grandchild();
 row('initial',c.read());row('chain',[c.chain(4.75),c.read(),c.readBase()]);
 row('int',[c.setCount(3.75),c.read()]);row('uint',[c.setFlags(-1),c.read()]);
 row('null',[c.chain(null),c.read()]);
 c.setCount(2147483647);row('prefix',[c.prefix(),c.read()]);
 c.setCount(2147483647);row('postfix',[c.postfix(),c.read()]);
 c.setFlags(0);row('decrement',[c.decrement(),c.read()]);
 c.setFlags(0);row('postdecrement',[c.postdecrement(),c.read()]);
 g.setWidth(9.5);row('grandchild',[g.inherited(),g.read(),g.readBase(),c.read()]);
 const read=c.read;row('bound',read.call(g));row('fresh',new Child().read());
 check('parent reused',loaded.getDefinition('superfields.Base')===Base&&Object.getPrototypeOf(Child.prototype)===(Base as Function).prototype);
 const sibling=await session.load('sibling',new ApplicationDomain(root));
 check('sibling identity',sibling.getDefinition('superfields.Base')===Base&&sibling.getDefinition('superfields.Child')!==Child);
 session.retire();check('parent survives retirement',root.getDefinition('superfields.Base')===Base);
 parentSession.retire();return {rows,checks};
}
