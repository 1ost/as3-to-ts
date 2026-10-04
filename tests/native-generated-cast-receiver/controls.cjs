const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module');
module.exports=(api,config)=>{
 const apply=(name,from,to,exported,action)=>{
  const file=require.resolve('../../lib/emit/'+name),loaded=require(file),original=fs.readFileSync(file,'utf8');
  assert.equal(original.split(from).length,2,'unique mutation: '+name);
  const changed=new Module(file,module);changed.filename=file;changed.paths=Module._nodeModulePaths(require('node:path').dirname(file));
  changed._compile(original.replace(from,to),file);
  const saved=loaded[exported];try{loaded[exported]=changed.exports[exported];return action();}finally{loaded[exported]=saved;}
 };
 let baselineError;
 apply('native-generated-lexical','publicIdentity = identity;','publicIdentity = undefined;','NativeGeneratedLexical',()=>{
  try{api.emitNativeSourceClassModule(config);}catch(e){baselineError=String(e.message);}
 });
 assert.match(baselineError||'',/lexical receiver requires exact source type/);
 const erasedCast=apply('emitter','if (emitter.generated && emitter.references && emitter.references.sourceClass(type.text))',
  'if (false && emitter.generated && emitter.references && emitter.references.sourceClass(type.text))','emit',()=>api.emitNativeSourceClassModule(config));
 return {baselineError,erasedCast};
};
