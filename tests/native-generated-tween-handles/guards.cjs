const assert=require('node:assert/strict');
module.exports=(api,input,config,hash)=>{
 let count=0;
 const fail=(fn,pattern=/UNSUPPORTED/)=>{assert.throws(fn,pattern);count++;};
 const compile=(changed,options={})=>{
  const plan=api.createNativeGeneratedDeclarationPlan(changed);
  return api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,...options,
   nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan}}});
 };
 const change=fn=>{const q='TweenHandleStorageProbe',source=fn(input.sources[q].source);assert.notEqual(source,input.sources[q].source);
  return {...input,sources:{[q]:{source,sourceSha256:hash(source)}}};};
 fail(()=>compile({...input,tweenHandleProviderModule:undefined}));
 fail(()=>compile(input,{nativeTweenModule:undefined}));
 fail(()=>compile(input,{nativeTweenModule:'./wrong-runtime'}));
 fail(()=>compile(input,{nativeTypedLocals:false}));
 fail(()=>compile(change(s=>s.replace('private var rows:Array','private var rows:TweenMax'))));
 fail(()=>compile(change(s=>s.replace('value:*):void','value:TweenMax):void'))));
 fail(()=>compile(change(s=>s.replace('function snapshot():Object','function snapshot():TweenMax'))));
 fail(()=>compile(change(s=>s.replace('var untouched:TweenMax','var untouched:TweenLite'))));
 fail(()=>compile(change(s=>s.replace('import com.greensock.TweenMax','import other.TweenMax'))));
 fail(()=>compile(change(s=>s.replace('handle = lite','handle += lite'))));
 fail(()=>compile(change(s=>s.replace('untouched === null','TweenMax === null'))));
 fail(()=>api.createNativeGeneratedDeclarationPlan({...input,providers:{'com.greensock.TweenMax':{module:input.tweenHandleProviderModule,exportName:'FlashTweenRuntime'}}}));
 fail(()=>api.emitNativeSourceClassModule({...config,externalModules:config.externalModules.filter(m=>m!==input.tweenHandleProviderModule)}));
 return count;
};
