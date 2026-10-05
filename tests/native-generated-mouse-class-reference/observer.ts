import '@ENGINE@/tests/nativeCanonicalSpriteClass/init-imports';
import {Laya} from '@ENGINE@/src/layaAir/Laya';
import {Mouse, MouseDeclaration} from '@MOUSE@';
import {Mouse as NativeMouse} from '@ENGINE@/src/layaAir/flash/ui/Mouse';
import {ApplicationDomain} from '@ENGINE@/src/layaAir/flash/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '@ENGINE@/src/layaAir/flash/utils/NativeSourceClassLoadingSession';
import {as3GetProperty} from '@ENGINE@/src/layaAir/flash/utils/AS3Property';
import {as3CallValue} from '@ENGINE@/src/layaAir/flash/utils/AS3Invocation';
import {as3AsClass} from '@ENGINE@/src/layaAir/flash/utils/AS3Class';
import {as3Is,as3As} from '@ENGINE@/src/layaAir/flash/utils/AS3Type';
import {as3DescribeTypeXML} from '@ENGINE@/src/layaAir/flash/utils/AS3ReflectionQuery';
import {nativeSourceClassModule as artifact} from './factory.js';

export async function run(){
 await Laya.init(160,100);
 const domain=new ApplicationDomain(ApplicationDomain.currentDomain);
 const session=createNativeSourceClassLoadingSession({resolve:()=>artifact,maxModules:1});
 await session.load('mouse',domain);
 const Reader=domain.getDefinition('mouseprobe.Reader');
 const mutations=new MutationObserver(()=>{});
 mutations.observe(document.body,{attributes:true,attributeOldValue:true,attributeFilter:['style']});
 const rows=as3CallValue(as3GetProperty(Reader,'run'),()=>[]);
 const records=mutations.takeRecords();mutations.disconnect();
 const cursorFromStyle=(style:string)=>{const element=document.createElement('div');element.setAttribute('style',style||'');return element.style.cursor;};
 const styles=[...records.slice(1).map(r=>cursorFromStyle(r.oldValue)),document.body.style.cursor];
 const transitions=styles.filter((s,i)=>i===0||s!==styles[i-1]);
 const checks:{id:string,passed:boolean}[]=[];
 const check=(id:string,passed:boolean)=>checks.push({id,passed});
 check('same-native-class',Mouse===NativeMouse);
 check('source-class',as3AsClass(Mouse)===Mouse);
 check('class-is-not-instance',!as3Is(Mouse,MouseDeclaration));
 check('prototype-is-not-instance',!as3Is(Mouse.prototype,MouseDeclaration));
 check('forged-instance-is-not-instance',!as3Is(Object.create(Mouse.prototype),MouseDeclaration));
 check('forged-instance-cast-is-null',as3As(Object.create(Mouse.prototype),MouseDeclaration)===null);
 check('undefined-cast-is-null',as3As(undefined,MouseDeclaration)===null);
 check('cursor-restored',Mouse.cursor==='auto'&&document.body.style.cursor==='auto');
 return {rows,checks,transitions,reflection:as3DescribeTypeXML(Mouse).toXMLString()};
}
