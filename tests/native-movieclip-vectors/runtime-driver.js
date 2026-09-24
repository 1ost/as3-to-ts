const nc=load('nativeClass'),Consumer=nc.readNativeClass(load('Consumer').Consumer),c=new Consumer(),rows=[];
rows.push({id:'default',value:c.slot===null});
class MovieChild extends api.MovieClip {}
const base=c.make(),clip=new api.MovieClip(),child=new MovieChild(),sprite=new api.Sprite(),shape=new api.Shape();base.push(clip);
const second=c.make();rows.push({id:'fresh',value:[base!==second,second.length]});
const objects=api.as3VectorFromValues(api.as3VectorPrimitiveSpec('Object'),[clip]);
const sprites=api.as3VectorFromValues(api.as3VectorClassSpec('flash.display::Sprite',api.Sprite),[clip]);
const inputs=[base,null,undefined,objects,sprites,[clip],{},clip];
for(let i=0;i<inputs.length;i++){const input=inputs[i];c.assign(base);
 try{const r=c.assign(input);rows.push({id:'assign:'+i,value:['ok',r===input,c.slot===input,c.slot===null]});}catch(e){if(!api.as3IsSourceErrorInstance(e))throw e;rows.push({id:'assign:'+i,value:[e.name,e.errorID,c.slot===base]});}
 try{const r=c.accept(input);rows.push({id:'accept:'+i,value:['ok',r===input,r===null]});}catch(e){if(!api.as3IsSourceErrorInstance(e))throw e;rows.push({id:'accept:'+i,value:[e.name,e.errorID]});}
}
const items=[clip,child,sprite,shape,null,undefined,{},7];
for(const method of ['push','write'])for(let i=0;i<items.length;i++){const v=c.make(),input=items[i];v.push(clip);
 try{const r=c[method](v,input);rows.push({id:method+':'+i,value:['ok',method==='push'?r:r===input,v.length,v[method==='push'?1:0]===input,v[method==='push'?1:0]===null]});}
 catch(e){if(!api.as3IsSourceErrorInstance(e))throw e;rows.push({id:method+':'+i,value:[e.name,e.errorID,v.length,v[0]===clip]});}
}
const fixed=c.sized(2,true);rows.push({id:'sized',value:[fixed.length,fixed.fixed,fixed[0]===null,fixed[1]===null]});
try{c.push(fixed,clip);}catch(e){if(!api.as3IsSourceErrorInstance(e))throw e;rows.push({id:'fixed-push',value:[e.name,e.errorID,api.as3IsSourceErrorInstance(e),e instanceof RangeError,e.message,fixed.length]});}
const v=c.make();v.push(clip,child);const removed=c.remove(v,0,1);rows.push({id:'splice',value:[removed!==v,removed[0]===clip,v[0]===child,removed.length,v.length]});
try{c.push(removed,sprite);}catch(e){if(!api.as3IsSourceErrorInstance(e))throw e;rows.push({id:'splice-type',value:[e.name,e.errorID,removed.length]});}
rows.push({id:'ancestry',value:[api.as3VectorIs(base,api.as3VectorClassSpec('flash.display::Sprite',api.Sprite)),api.as3VectorIs(base,api.as3VectorClassSpec('flash.display::DisplayObject',api.DisplayObject)),api.as3VectorIs(base,api.as3VectorInterfaceSpec(api.IEventDispatcher)),api.as3VectorIs(base,api.as3VectorPrimitiveSpec('Object')),api.as3VectorIs(sprites,api.as3VectorClassSpec('flash.display::MovieClip',api.MovieClip))]});
// Native provider guards are separate from captured source behavior.
for(const action of [()=>api.as3VectorCanonicalSpec('flash.display::MovieClip',function MovieClip(){}),()=>api.as3VectorCanonicalSpec('wrong',api.MovieClip),()=>c.push(base,Object.create(api.MovieClip.prototype))]){
 let rejected=false;try{action();}catch(e){rejected=true;}if(!rejected)throw Error('native identity guard accepted');
}
let traps=0;const proxy=new Proxy(clip,{get(){traps++;throw Error('get');},getPrototypeOf(){traps++;throw Error('prototype');}});
let rejected=false;try{c.push(base,proxy);}catch(e){rejected=api.as3IsSourceErrorInstance(e);}if(!rejected||traps!==0)throw Error('proxy observed');
globalThis.result=rows;
