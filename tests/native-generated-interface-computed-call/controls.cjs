const assert=require('assert/strict'),fs=require('fs'),path=require('path'),Module=require('module');
module.exports=(variant,action,output)=>{
 const file=require.resolve('../../lib/emit/emitter'),loaded=require(file),source=fs.readFileSync(file,'utf8');
 const start=source.indexOf('function emitComputedInterfaceCall('),end=source.indexOf('function emitInterfaceMethodCall(',start);assert(start>=0&&end>start);
 let section=source.slice(start,end);
 const replace=(from,to)=>{assert.equal(section.split(from).length,2);section=section.replace(from,to);};
 if(variant==='public-only-call')replace("const helper = dynamicHelper(emitter, access, 'Call', emitter.options.nativeDynamicPropertyReadsModule);","access.lexical = false; const helper = dynamicHelper(emitter, access, 'Call', emitter.options.nativeDynamicPropertyReadsModule);");
 else {assert.equal(variant,'eager-arguments');replace("emitter.insert(',()=>[');","emitter.insert(',((args)=>(()=>args))([');");replace("emitter.insert(']))');","emitter.insert('])))');");}
 const altered=source.slice(0,start)+section+source.slice(end);fs.writeFileSync(output,altered);
 const modified=new Module(file,module);modified.filename=file;modified.paths=Module._nodeModulePaths(path.dirname(file));modified._compile(altered,file);
 const saved=loaded.emit;try{loaded.emit=modified.exports.emit;return action();}finally{loaded.emit=saved;}
};
