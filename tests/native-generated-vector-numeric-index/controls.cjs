const assert=require('assert/strict'),fs=require('fs'),path=require('path'),Module=require('module');
module.exports=(variant,action,output)=>{
 const file=require.resolve('../../lib/emit/emitter'),loaded=require(file),source=fs.readFileSync(file,'utf8');let altered=source;
 if(variant==='legacy-indexing'){
  for(const from of ["if (operator.text === '=' && emitVectorIndex(emitter, left, right))",'if (emitVectorIndex(emitter, node))']){assert.equal(altered.split(from).length,2);altered=altered.replace(from,'if (false)');}
 }else{
  const from='return { receiver, key, numeric: true };';assert.equal(altered.split(from).length,2);altered=altered.replace(from,'return { receiver, key, numeric: false };');
 }
 fs.writeFileSync(output,altered);
 const modified=new Module(file,module);modified.filename=file;modified.paths=Module._nodeModulePaths(path.dirname(file));modified._compile(altered,file);
 const saved=loaded.emit;try{loaded.emit=modified.exports.emit;return action();}finally{loaded.emit=saved;}
};
