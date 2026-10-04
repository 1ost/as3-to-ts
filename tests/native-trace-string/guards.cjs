const assert=require('node:assert/strict');
module.exports=(api,input,config,hash)=>{
 let guards=0;
 function emit(body, overrides={}){
  const source='package {public class TraceSubject {'+body+'}}';
  const plan=api.createNativeGeneratedDeclarationPlan({...input,sources:{TraceSubject:{source,sourceSha256:hash(source)}}});
  return api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,...overrides,nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan},nativeVectorTypes:{...config.emitterOptions.nativeVectorTypes,plan}}});
 }
 for(const name of ['nativeTypedLocalAdditionModule','nativeTypedLocals']){
  assert.throws(()=>emit('public function run(value:*):void{trace("prefix:"+value);}',{[name]:undefined}),/AS3_(TYPED_LOCAL|GLOBAL_MODULE)_UNSUPPORTED/);guards++;
 }
 for(const expression of ['trace()','trace("a","b")','trace(7)','trace({})','trace','new trace("a")','trace(value + ":right")','trace(1 + 2 + ":right")','trace((value + ":right") + 5)','trace("a" - 1)','trace("a" + 1 - 2)']){
  assert.throws(()=>emit('public function run(value:*):*{return '+expression+';}'),/AS3_GLOBAL_MODULE_UNSUPPORTED/,expression);guards++;
 }
 for(const body of ['public function run(trace:Function):void{trace("shadow:"+1);}',
  'public function trace(value:String):void{} public function run():void{trace("shadow:"+1);}']){
  const a=emit(body);assert(!a.generatedSources.some(s=>s.source.includes('__as3_global_trace')));guards++;
 }
 return guards;
};
