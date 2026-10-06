const assert=require('assert/strict'),fs=require('fs'),path=require('path'),Module=require('module'),api=require('../../lib');
module.exports=action=>{
 const file=require.resolve('../../lib/emit/emitter'),loaded=require(file),source=fs.readFileSync(file,'utf8'),from='inlineTarget || referenceTarget || localTarget';assert.equal(source.split(from).length,2);
 const modified=new Module(file,module);modified.filename=file;modified.paths=Module._nodeModulePaths(path.dirname(file));modified._compile(source.replace(from,'inlineTarget || localTarget'),file);
 const saved=loaded.emit;try{loaded.emit=modified.exports.emit;return action();}finally{loaded.emit=saved;}
};
