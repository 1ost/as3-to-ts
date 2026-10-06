const assert=require('assert/strict'),fs=require('fs'),path=require('path'),Module=require('module');
module.exports=(variant,action,output)=>{
 const file=require.resolve('../../lib/emit/emitter'),loaded=require(file),source=fs.readFileSync(file,'utf8');
 let altered;
 if(variant==='raw-interface-read'){
  const from='const computedInterface = sourceInterfaceComputedReadAccess(emitter, node);';assert.equal(source.split(from).length,2);
  altered=source.replace(from,'const computedInterface = null;');
 }else{
  assert.equal(variant,'public-only-read');const start=source.indexOf('function sourceInterfaceComputedReadAccess('),end=source.indexOf('function sourceInterfaceAccessorAccess(',start);assert(start>=0&&end>start);
  const section=source.slice(start,end),from='return { receiver, key, lexical: true };';assert.equal(section.split(from).length,2);
  altered=source.slice(0,start)+section.replace(from,'return { receiver, key, lexical: false };')+source.slice(end);
 }
 fs.writeFileSync(output,altered);
 const modified=new Module(file,module);modified.filename=file;modified.paths=Module._nodeModulePaths(path.dirname(file));modified._compile(altered,file);
 const saved=loaded.emit;try{loaded.emit=modified.exports.emit;return action();}finally{loaded.emit=saved;}
};
