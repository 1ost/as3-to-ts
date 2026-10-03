const assert=require('node:assert/strict');
module.exports=(api,input,config,hash)=>{
 let guards=0;
 const emit=source=>{const plan=api.createNativeGeneratedDeclarationPlan({...input,sources:{'cases.Guard':{source,sourceSha256:hash(source)}},classScriptSources:['cases.Guard']});return api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,definitionsByNamespace:{cases:['Guard']},nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan}}});};
 for(const expression of ['int.MAX_VALUE+1','int.UNKNOWN','uint.MAX_VALUE()','other.MAX_VALUE']){
  assert.throws(()=>emit('package cases {public class Guard {public static const VALUE:int='+expression+';}}'),/computed static constant initialization requires source authority/);guards++;
 }
 assert.throws(()=>emit('package cases {public class Guard {private static var int:Object;public static const VALUE:int=int.MAX_VALUE;}}'),/computed static constant initialization requires source authority/);guards++;
 const ordinary=api.createNativeGeneratedDeclarationPlan({...input,classScriptSources:undefined});
 assert.doesNotThrow(()=>api.emitNativeSourceClassModule({...config,plan:ordinary,emitterOptions:{...config.emitterOptions,nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan:ordinary}}}));guards++;
 assert.throws(()=>emit('package cases {public class Guard {public static function call():Number{return Math.round();}}}'),/Math.round requires exactly one source argument/);guards++;
 const shadow=emit('package cases {public class Guard {public static function call(Math:Object):Number{return Math.round(1);}}}');assert(!shadow.moduleSource.includes('as3MathRound'),'shadowed Math must retain source method lookup');guards++;
 const helper=require('../../lib/emit/native-builtin-numeric-constants'),saved=helper.nativeBuiltinNumericConstants;
 try{helper.nativeBuiltinNumericConstants=()=>Object.freeze(Object.create(null));assert.throws(()=>api.emitNativeSourceClassModule(config),/computed static constant initialization requires source authority/);guards++;}finally{helper.nativeBuiltinNumericConstants=saved;}
 return guards;
};
