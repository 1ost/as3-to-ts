const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{createHash}=require('node:crypto');
const compiler=path.resolve(__dirname,'../..'),selected=path.resolve(process.env.TYPE_RESOLUTION_LIB),current=path.join(compiler,'lib'),resolve=Module._resolveFilename;
Module._resolveFilename=function(request,parent,...args){const file=resolve.call(this,request,parent,...args);return file===current||file.startsWith(current+path.sep)?path.join(selected,path.relative(current,file)):file;};
const hash=v=>createHash('sha256').update(v).digest('hex'),unit=require(path.join(selected,'emit/native-source-unit.js')),originalResolver=unit.nativeSourceUnitResolver;
let resolutions=0;unit.nativeSourceUnitResolver=function(...args){const resolver=originalResolver(...args);return function(...args){resolutions++;return resolver(...args);};};
const api=require(path.join(selected,'index.js')),originalEmit=api.emitNativeSourceClassModule,emissions=[];
api.emitNativeSourceClassModule=function(...args){try{const artifact=originalEmit(...args);emissions.push({sha256:hash(JSON.stringify(artifact))});return artifact;}catch(error){emissions.push({error:error.message});throw error;}};
process.on('exit',code=>{fs.writeFileSync(process.env.TYPE_RESOLUTION_CAPTURE,JSON.stringify({code,resolutions,emissions},null,2)+'\n');});
