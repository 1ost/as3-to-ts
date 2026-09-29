// Run only the authenticated engine parser. Bundle from hash-checked bytes so
// imports cannot escape the previously verified provider's source closure.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),esbuild=require('esbuild');
const input=JSON.parse(fs.readFileSync(0,'utf8'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
(async()=>{
 const built=await esbuild.build({entryPoints:[path.resolve(input.root,input.module)],bundle:true,write:false,
  platform:'node',format:'cjs',target:'node24',logLevel:'silent',plugins:[{name:'pinned-source-closure',setup(build){
   build.onLoad({filter:/.*/},args=>{
    const relative=path.relative(input.root,args.path).split(path.sep).join('/');
    if(!Object.prototype.hasOwnProperty.call(input.sources,relative)||fs.realpathSync.native(args.path)!==args.path)
     throw Error('Unpinned provider dependency: '+relative);
    const bytes=fs.readFileSync(args.path);
    if(hash(bytes)!==input.sources[relative])throw Error('Provider source changed: '+relative);
    const extension=path.extname(args.path);
    const loader=extension==='.ts'?'ts':extension==='.js'?'js':['.glsl','.vs','.fs','.wgsl'].includes(extension)?'text':null;
    if(!loader)throw Error('Unsupported provider source: '+relative);
    return {contents:bytes,loader};
   });
  }}]});
 const module={exports:{}};
 new Function('module',built.outputFiles[0].text)(module);
 try { module.exports.compileSourceStringPattern(input.source,input.flags);process.stdout.write('{"admitted":true}'); }
 catch(error){if(error instanceof TypeError&&error.message.startsWith('AS3_STRING_INTRINSIC_UNSUPPORTED:'))process.stdout.write('{"admitted":false}');else throw error;}
})().catch(error=>{console.error(error);process.exitCode=1;});
