import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set,as3DeleteProperty} from '@FLASH@/utils/AS3Property';
import {as3CallValue} from '@FLASH@/utils/AS3Invocation';
import {as3ConstructClass} from '@FLASH@/utils/AS3Class';
import {as3Is} from '@FLASH@/utils/AS3Type';
import {ContextMenuClipboardItems as Items} from '@FLASH@/utils/AS3CanonicalContextMenuClipboardItems';
import {ContextMenu} from '@FLASH@/ui/ContextMenu';
import {describeRegisteredFlashType,describeRegisteredFlashInstanceType} from '@FLASH@/utils/FlashTypeMetadata';
export async function run(module){
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});await session.load('clipboard',domain);
 const reader=as3ConstructClass(domain.getDefinition('clipboard.Reader'),[]),call=(object,name,...args)=>as3CallValue(get(object,name),()=>args);
 const rows=[],record=(id,value)=>rows.push({id,value}),run=(id,fn)=>{try{record(id,fn());}catch(e){rows.push({id,error:[e.name,e.errorID]});}},flags=a=>['cut','copy','paste','clear','selectAll'].map(n=>get(a,n));
 const a=as3ConstructClass(Items,[]);let b=as3ConstructClass(Items,[]),menu=new ContextMenu();
 run('defaults',()=>flags(a));
 for(const name of ['cut','copy','paste','clear','selectAll'])for(const [j,value]of [undefined,null,false,0,'','false',1,{},[]].entries()){
  const raw=set(a,name,value);record('write:'+name+':'+j,[raw===value,get(a,name),typeof get(a,name)]);
 }
 run('independent',()=>flags(b));
 for(const [name,value]of [['cut',false],['copy',true],['paste',false],['clear',true],['selectAll',false]])set(a,name,value);
 run('clone',()=>{b=call(a,'clone');const same=flags(b);set(b,'copy',false);return [b!==a,as3Is(b,Items),same,get(a,'copy'),get(b,'copy')];});
 run('menu-defaults',()=>[menu.clipboardMenu,flags(menu.clipboardItems),menu.clipboardItems===menu.clipboardItems,new ContextMenu().clipboardItems!==menu.clipboardItems]);
 run('menu-assign',()=>{menu.clipboardItems=a;return [menu.clipboardItems===a,flags(menu.clipboardItems)];});
 run('menu-alias',()=>{set(a,'paste',true);return [menu.clipboardItems.paste,menu.clipboardItems===a];});
 run('menu-null',()=>{menu.clipboardItems=null;return menu.clipboardItems===null;});
 run('menu-undefined',()=>{menu.clipboardItems=undefined;return menu.clipboardItems===null;});
 run('menu-invalid',()=>{menu.clipboardItems={} as any;return 'missing error';});
 run('menu-toggle',()=>{menu.clipboardItems=a;menu.clipboardMenu=true;menu.hideBuiltInItems();return [menu.clipboardMenu,flags(menu.clipboardItems),menu.clipboardItems===a];});
 run('extra-constructor-argument',()=>flags(as3ConstructClass(Items,[1])));
 run('unknown-read',()=>get(a,'missing'));run('unknown-write',()=>{set(a,'missing',1);return 'missing error';});run('delete-slot',()=>as3DeleteProperty(a,'copy'));
 run('bound-clone',()=>{const fn=get(a,'clone') as Function,item=fn.call({});return [as3Is(item,Items),flags(item)];});
 run('typed-read',()=>call(reader,'read',a));run('typed-null',()=>call(reader,'nullish',null));run('typed-undefined',()=>call(reader,'nullish',undefined));run('typed-invalid',()=>call(reader,'read',{cut:false}));
 run('typed-write',()=>{const result=call(reader,'write',a,'');return [result==='',get(a,'copy')];});
 run('typed-clone',()=>{const item=call(reader,'clone',a);return [item!==a,as3Is(item,Items),flags(item)];});
 run('return-identity',()=>call(reader,'returned',a)===a);run('return-null',()=>call(reader,'returned',null)===null);run('return-undefined',()=>call(reader,'returned',undefined)===null);run('return-invalid',()=>call(reader,'returned',{}));
 record('class-document' ,describeRegisteredFlashType(Items).reflectionAuthority.document);record('instance-document',describeRegisteredFlashInstanceType(Items).reflectionAuthority.document);
 const checks=[];for(const [id,value]of [['prototype-forgery',Object.create(Items.prototype)],['proxy-forgery',new Proxy(a,{})],['class-is-not-instance',Items]]){
  let error;try{call(reader,'read',value);}catch(e){error=e;}if(error?.name!=='TypeError'||error?.errorID!==1034)throw Error(id);checks.push(id);
 }
 return {rows,checks};
}
