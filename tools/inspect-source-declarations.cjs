"use strict";
// Recover source identities with the same authenticated parser as qualification.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),{fork}=require("node:child_process");
const hash=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");
const root=fs.realpathSync(process.argv[2]),relative=process.argv.slice(3);
const includeIndex=relative.indexOf('--source-includes');
const includeFile=includeIndex<0?null:relative.splice(includeIndex,2)[1];
const includes=includeFile?require('../lib/source-includes.js').loadSourceIncludes(fs.readFileSync(includeFile,'utf8')):null;
const worker=path.resolve(__dirname,"../lib/declaration-worker.js"),workerSha256=hash(fs.readFileSync(worker));
if(!relative.length || relative.length>10000)throw new Error("Provide a bounded set of relative AS3 source paths");
async function inspect(sourcePath){
 const file=path.resolve(root,sourcePath);
 if(!file.startsWith(root+path.sep) || !file.endsWith(".as") || fs.realpathSync(file)!==file || !fs.lstatSync(file).isFile())throw new Error("Unsafe source path");
 const bytes=fs.readFileSync(file);if(bytes.length>8*1024*1024)throw new Error("Source exceeds declaration limit");
 const content=new TextDecoder("utf-8",{fatal:true}).decode(bytes).replace(/\r\n?/g,"\n");
 return new Promise((resolve,reject)=>{
  const child=fork(worker,[],{execArgv:["--max-old-space-size=512"],stdio:["ignore","pipe","pipe","ipc"]});
  let reply=null,output=false;
  const timeout=setTimeout(()=>{child.kill();reject(new Error("Declaration worker timeout: "+sourcePath));},60000);
  child.stdout.on("data",()=>output=true);child.stderr.on("data",()=>output=true);
  child.on("error",error=>{clearTimeout(timeout);reject(error);});
  child.on("message",message=>{reply=message;});
  child.on("exit",code=>{
   clearTimeout(timeout);
   if(code!==0 || output || !reply || reply.workerSha256!==workerSha256)return reject(new Error("Invalid declaration envelope: "+sourcePath));
   if(!reply.ok)return resolve({sourcePath,sourceSha256:hash(bytes),status:"held",error:reply.error});
   if(Buffer.byteLength(reply.json)!==reply.byteLength)return reject(new Error("Invalid declaration length"));
   const declaration=JSON.parse(reply.json);
   if(declaration.sourceSha256!==hash(content))return reject(new Error("Declaration source drift"));
   resolve({sourcePath,sourceSha256:hash(bytes),status:"complete",declaration});
  });
  if(includes && (!includes.inventory.roots.some(item=>item.path===sourcePath && item.sha256===hash(bytes)) || includes.inventory.sourceRoot!==root)) return reject(new Error('Include root identity mismatch'));
  child.send({...includes?{includeRootPath:sourcePath,includeFragments:includes.fragments,includeEdges:includes.inventory.edges}:{},sourcePath,content,maxResultBytes:4*1024*1024,workerSha256});
 });
}
(async()=>{const entries=[];for(const name of relative)entries.push(await inspect(name));process.stdout.write(JSON.stringify({schema:"as3-source-declarations@1",workerSha256,entries})+"\n");})().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
