const assert=require('assert/strict'),api=require('../../lib'),parse=require('../../lib/parse'),fs=require('fs'),Module=require('module');
const {sources}=require('./compile.cjs');
module.exports=config=>{
 const q='left.LeftFactory',source=sources[q].source,identity=q+'#file:Queue',options={...config.emitterOptions,nativeGeneratedDeclarations:{plan:config.plan,module:'./__native_declarations',declarationIdentity:identity}};
 options.nativeReferenceCoercion={...options.nativeReferenceCoercion,module:'./__native_declarations'}; const emit=(text,opts=options)=>api.Emitter.emit(parse(q+'.as',text),text,opts);
 assert.throws(()=>emit(source+' '),/exact current source bytes/);
 assert.throws(()=>emit(source,{...options,nativeGeneratedDeclarations:{...options.nativeGeneratedDeclarations,declarationIdentity:'right.RightFactory#file:Queue'}}),/exact planned scope\/source capability/);
 const file=require.resolve('../../lib/emit/emitter'),original=fs.readFileSync(file,'utf8'),changed=original.replace('v.owner === owner && v.start === node.start','v.owner === owners[0] && v.start === node.start');assert.notEqual(changed,original);const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(require('path').dirname(file));m._compile(changed,file);
 assert.throws(()=>m.exports.emit(parse(q+'.as',source),source,options),/exact source specialization required/);
 return ['changed source rejected','foreign declaration rejected','mutation: original Vector annotation owner'];
};
