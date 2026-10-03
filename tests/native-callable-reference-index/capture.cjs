const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const compiler=path.resolve(__dirname,'../..'),selected=path.resolve(process.env.REFERENCE_INDEX_LIB),current=path.join(compiler,'lib'),resolve=Module._resolveFilename;
Module._resolveFilename=function(request,parent,...args){const file=resolve.call(this,request,parent,...args);return file===current||file.startsWith(current+path.sep)?path.join(selected,path.relative(current,file)):file;};
globalThis.referenceIndexCounters={comparisons:0,indexRows:0};
const originalLoad=Module._extensions['.js'],target=path.join(selected,'emit/native-callable-classes.js');
Module._extensions['.js']=function(module,file){
 if(file!==target)return originalLoad(module,file);
 let source=fs.readFileSync(file,'utf8');
 const predicate=/\.find\(ref => (?:ref\.owner === qname && )?ref\.start === (?:type\.)?start && ref\.end === (?:type\.)?end\)/g;
 assert.equal([...source.matchAll(predicate)].length,1,'Instrument only the constructor reference search');
 source=source.replace(predicate,match=>match.replace('ref => ','ref => (globalThis.referenceIndexCounters.comparisons++, ').replace(/\)$/,'))'));
 const insertion='references.push(reference);';
 if(source.includes('referencesByOwner = new Map();')){
  assert.equal(source.split(insertion).length,2);
  source=source.replace(insertion,'globalThis.referenceIndexCounters.indexRows++; '+insertion);
 }
 module._compile(source,file);
};
const hash=v=>createHash('sha256').update(v).digest('hex'),api=require(path.join(selected,'index.js')),originalEmit=api.emitNativeSourceClassModule,emissions=[];
api.emitNativeSourceClassModule=function(...args){try{const artifact=originalEmit(...args);emissions.push({sha256:hash(JSON.stringify(artifact))});return artifact;}catch(error){emissions.push({error:error.message});throw error;}};
process.on('exit',code=>fs.writeFileSync(process.env.REFERENCE_INDEX_CAPTURE,JSON.stringify({code,...globalThis.referenceIndexCounters,emissions},null,2)+'\n'));
