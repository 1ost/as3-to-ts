const assert=require('assert/strict'),fs=require('fs'),path=require('path'),Module=require('module'),api=require('../../lib');
module.exports=config=>{
 function mutate(name,from,to,exported){
  const file=require.resolve('../../lib/emit/'+name),loaded=require(file),source=fs.readFileSync(file,'utf8');assert.equal(source.split(from).length,2);
  const modified=new Module(file,module);modified.filename=file;modified.paths=Module._nodeModulePaths(path.dirname(file));modified._compile(source.replace(from,to),file);
  const saved=loaded[exported];try{loaded[exported]=modified.exports[exported];return api.emitNativeSourceClassModule(config);}finally{loaded[exported]=saved;}
 }
 return {discard:mutate('emitter',"emitter.insert('(void ')","emitter.insert('(')",'emit'),dispatch:mutate('native-generated-lexical','publicIdentity !== this.owner || sourceCastReceiver','publicIdentity !== this.owner','NativeGeneratedLexical')};
};
