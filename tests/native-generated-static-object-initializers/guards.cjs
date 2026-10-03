const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module');
module.exports=(api,input,config,hash)=>{
 let guards=0;
 for(const initializer of ['true','7']){
  const source='package cases {public class Guard {private static var value:Object='+initializer+';}}';
  const plan=api.createNativeGeneratedDeclarationPlan({...input,classScriptSources:['cases.Guard'],sources:{'cases.Guard':{source,sourceSha256:hash(source)}}});
  assert.throws(()=>api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,definitionsByNamespace:{cases:['Guard']},nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan}}}),/static lexical literal storage requires qualification/);guards++;
 }
 const file=require.resolve('../../lib/emit/native-generated-lexical'),lexical=require(file),saved=lexical.NativeGeneratedLexical;
 const source=fs.readFileSync(file,'utf8'),marker='[nodeKind_1.default.ARRAY, nodeKind_1.default.OBJECT, nodeKind_1.default.CALL';
 assert(source.includes(marker),'static object baseline marker');
 const mutant=new Module(file,module);mutant.filename=file;mutant.paths=module.paths;
 mutant._compile(source.replace(marker,'[nodeKind_1.default.ARRAY, nodeKind_1.default.CALL'),file);
 try{lexical.NativeGeneratedLexical=mutant.exports.NativeGeneratedLexical;assert.throws(()=>api.emitNativeSourceClassModule(config),/static lexical literal storage requires qualification/);guards++;}finally{lexical.NativeGeneratedLexical=saved;}
 return guards;
};
