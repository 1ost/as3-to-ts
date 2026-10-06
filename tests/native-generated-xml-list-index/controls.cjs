const assert=require('assert/strict'),fs=require('fs'),path=require('path'),Module=require('module');
module.exports=(variant,action,output)=>{
 const file=require.resolve('../../lib/emit/native-xml'),loaded=require(file),source=fs.readFileSync(file,'utf8');
 const from="emit(n, n.children[0], 'as3XMLListIndex', String(selected));";
 assert.equal(source.split(from).length,2);
 const to=variant==='raw-index'?'return false;':"emit(n, n.children[0], 'as3XMLListIndex', '0');";
 assert(['raw-index','first-only'].includes(variant));const altered=source.replace(from,to);fs.writeFileSync(output,altered);
 const modified=new Module(file,module);modified.filename=file;modified.paths=Module._nodeModulePaths(path.dirname(file));modified._compile(altered,file);
 const saved=loaded.emitNativeXML;try{loaded.emitNativeXML=modified.exports.emitNativeXML;return action();}finally{loaded.emitNativeXML=saved;}
};
