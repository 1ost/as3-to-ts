import 'ENGINE/tests/nativeCanonicalDisplayAncestry/init-imports';
import {Laya} from 'ENGINE/src/layaAir/Laya';
import {Render} from 'ENGINE/src/layaAir/laya/renders/Render';
import {ApplicationDomain} from 'ENGINE/src/layaAir/flash/system/ApplicationDomain';
import {loadAndActivateAuthoredContentCatalog} from 'ENGINE/src/extensions/authoredContent/runtime/AuthoredContentCatalog';
import {getQualifiedClassName} from 'ENGINE/src/layaAir/flash/utils/getQualifiedClassName';
(async()=>{
    await Laya.init(640,360);Render.paused=true;
    const {roots}=await import('./wrappers');
    const unbound:string[]=[];
    for(const root of roots){
        let error:unknown;try{new root.ctor();}catch(e){error=e;}
        if(!(error instanceof TypeError)||!String(error).includes('before allocation'))throw Error('unbound generated wrapper guard differs: '+root.linkage+': '+String((error as any)?.stack||error));
        unbound.push(root.linkage);
    }
    const catalog=await loadAndActivateAuthoredContentCatalog('/assets/catalog.json',{loader:Laya.loader,applicationDomain:new ApplicationDomain()});
    for(const root of roots)catalog.bindSourceClass(root.linkage,root.ctor);
    const rows:any[]=[],exactNested:boolean[]=[];
    for(const root of roots){
        const receiver=new root.ctor();
        try{
            const members=Object.entries(root.members).map(([name,type])=>{
                const nested=roots.find(r=>r.local===type);
                if(nested)exactNested.push(receiver[name].constructor===nested.ctor);
                return {name,declaredType:type==='MovieClip'?'flash.display::MovieClip':type==='TextField'?'flash.text::TextField':nested.className.replace(/\.([^.]*)$/,'::$1'),actualType:getQualifiedClassName(receiver[name])};
            });
            rows.push({id:root.linkage,value:{constructed:true,qualified:getQualifiedClassName(receiver),members}});
        }finally{receiver.destroy(true);}
    }
    Object.assign(globalThis,{embedResult:{rows,unbound,exactNested}});
})().catch(error=>Object.assign(globalThis,{embedError:String(error.stack||error)}));
