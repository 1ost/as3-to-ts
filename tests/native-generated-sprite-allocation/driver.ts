import 'ENGINE/tests/nativeDisplayProjection/entry';
import {nativeSourceClassModule as mainModule} from './main.js';
import {nativeSourceClassModule as childModule} from './child.js';
import {createNativeSourceClassLoadingSession} from 'ENGINE/src/layaAir/flash/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from 'ENGINE/src/layaAir/flash/system/ApplicationDomain';
import {PerspectiveProjection} from 'ENGINE/src/layaAir/flash/geom/PerspectiveProjection';
import {state} from 'ENGINE/tests/nativeDisplayProjection/observe.js';

(globalThis as any).done=(async()=>{
 const session=createNativeSourceClassLoadingSession({resolve:url=>url==='main'?mainModule:childModule,maxModules:2});
 const a=await session.load('main',new ApplicationDomain(ApplicationDomain.currentDomain));
 const b=await session.load('child',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Main:any=a.getDefinition('host.ParentCallbacks'),Child:any=b.getDefinition('host.ParentCallbacks');
 const main=new Main(),child=new Child(),callback=child.callback();
 const inspect=(value:any)=>{value.transform.perspectiveProjection=new PerspectiveProjection();return state(value.transform.perspectiveProjection);};
 const rows=[inspect(main.make()),inspect(child.make()),inspect(main.invoke(child.make)),inspect(child.invoke(main.make)),
  inspect(Child.makeStatic()),inspect(Main.makeStatic()),inspect(main.invoke(callback))];
 session.retire();rows.push(inspect(callback()));
 (globalThis as any).allocationResult=rows;
})();
