const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),api=require('../../lib');
const {sources,compile,root,hash}=require('./compile.cjs');
module.exports=config=>{
 const guards=[],source=sources['model.IReader'].source,opts={nativeVectorTypes:{plan:config.plan,module:'./__native_declarations',declarationIdentity:'model.IReader'}};
 const emit=(s,o)=>api.Emitter.emit(require('../../lib/parse')('model.IReader.as',s),s,o);
 assert.throws(()=>emit(source+' ',opts),/exact planned scope\/source capability/);guards.push('changed source rejected');
 assert.throws(()=>emit(source,{nativeVectorTypes:{...opts.nativeVectorTypes,plan:JSON.parse(JSON.stringify(config.plan))}}),/exact planned/);guards.push('forged plan rejected');
 assert.throws(()=>emit(sources['client.Factory'].source,{nativeVectorTypes:{...opts.nativeVectorTypes,declarationIdentity:'client.Factory'}}),/exact interface declaration required/);guards.push('class selection rejected');
 const file=require.resolve('../../lib/emit/emitter'),text=fs.readFileSync(file,'utf8');
 const mutated=text.replace('emitter.selectedInterface ? emitter.options.nativeVectorTypes.plan : undefined','false ? emitter.options.nativeVectorTypes.plan : undefined');assert.notEqual(mutated,text);
 const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(mutated,file);
 const saved=api.Emitter.emit;try{api.Emitter.emit=m.exports.emit;assert.throws(()=>api.emitNativeSourceClassModule(config),/unbound TypeScript dependency: .*scope\/detail/);guards.push('disabled interface namespace handling reproduces baseline');}finally{api.Emitter.emit=saved;}
 const classSource='package scope { public class detail {} }';
 const folder=fs.mkdtempSync(path.join(root,'.cache/interface-namespace-namesake-'));
 const namesake=compile(folder,config.target,{...sources,'scope.detail':{source:classSource,sourceSha256:hash(classSource)}});
 const interfaces=namesake.artifact.generatedSources.filter(s=>s.module.startsWith('./__native_interface_'));
 assert.equal(interfaces.length,2);for(const item of interfaces)assert.match(item.source,/import \{ detail \} from "\.\/__native_class_\d+"/);
 guards.push('same-name Class imports retained on both interfaces');
 return guards;
};
