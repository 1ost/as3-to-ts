import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import * as api from '@FLASH@/utils/AS3Property';
export async function run(parentModule:NativeSourceClassModule,childModule:NativeSourceClassModule){
 const checks:string[]=[];
 const check=(id:string,value:boolean)=>{if(!value)throw Error(id);checks.push(id);};
 const root=ApplicationDomain.currentDomain;
 const parentSession=createNativeSourceClassLoadingSession({resolve:()=>parentModule,maxModules:1});
 const parent=await parentSession.load('parent',root),Parent=parent.getDefinition('constantcases.PrivateConstants');
 const session=createNativeSourceClassLoadingSession({resolve:()=>childModule,maxModules:2});
 const loaded=await session.load('child',new ApplicationDomain(root));
 const klass=(name:string):any=>loaded.getDefinition('constantcases.'+name);
const Base=klass('PrivateConstants'),Child=klass('ChildConstants'),Spy=klass('ValueSpy');
const rows=[],row=(id,value)=>rows.push({id,value});
const base=new Base(),child=new Child();
row('early',Base.before);
row('direct',[base.read(),Base.readStatic()]);
row('child',[child.read(),child.readChild()]);
row('shadow',Base.shadow('argument'));
row('named',[Base.readName('MESSAGE'),child.readChildName('MESSAGE')]);
const spy=new Spy();
try{Base.writeName('MESSAGE',spy);row('write','accepted');}
catch(e){row('write',[api.as3GetProperty(e,'name'),api.as3GetProperty(e,'errorID'),spy.calls,Base.readStatic()]);}
row('delete',[Base.removeName('MESSAGE'),Base.readStatic()]);
const absent=api.as3GetProperty(Base,'MESSAGE');
row('external',[typeof absent,absent===undefined,absent===null]);
row('fresh',[new Base().read(),new Child().readChild()]);
row('states',Base.states());
row('limits',Base.limits());


 check('parent reused',Base===Parent&&Object.getPrototypeOf(Child.prototype)===Base.prototype);
 const sibling=await session.load('sibling',new ApplicationDomain(root));
 check('sibling identity',sibling.getDefinition('constantcases.PrivateConstants')===Base&&sibling.getDefinition('constantcases.ChildConstants')!==Child);
 session.retire();check('parent survives retirement',root.getDefinition('constantcases.PrivateConstants')===Base);
 parentSession.retire();return {rows,checks};
}
