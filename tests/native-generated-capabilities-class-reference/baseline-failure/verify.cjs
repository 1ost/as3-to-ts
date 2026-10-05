const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const context=vm.createContext({console,setTimeout,clearTimeout,performance,AbortController,AbortSignal,DOMException});
new vm.Script(fs.readFileSync(path.join(__dirname,'bundle.cjs'),'utf8')).runInContext(context);
context.completion.then(()=>{
 const rows=JSON.parse(JSON.stringify(context.result));
 assert.deepEqual(rows,JSON.parse(fs.readFileSync(path.join(__dirname,'observed.json'))));
 assert.equal(rows[1].error.message,'AS3_CLASS_UNSUPPORTED: native class lacks exact source metadata');
 console.log(JSON.stringify({status:'reproduced',baselineClassIdentityFailure:true}));
}).catch(error=>{console.error(error);process.exitCode=1;});
