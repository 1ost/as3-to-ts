const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),z=require('node:zlib'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),oldRepo='C:/Users/admin/Desktop/GITHUB REPO/op2-html5',compiler=path.join(root,'compiler'),engine=path.join(root,'engine');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const archive=path.join(oldRepo,'game-client-laya/tests/startup-prompt-text-review/error-event-type-tests-candidate.json.gz'),pinFile=archive.replace('.json.gz','-pin.json');
const bytes=fs.readFileSync(archive),pin=JSON.parse(fs.readFileSync(pinFile));assert.equal(hash(bytes),pin.sha256);
const packet=JSON.parse(z.gunzipSync(bytes));assert.equal(packet.files.length,pin.files);
for(const i of packet.files){assert.equal(hash(Buffer.from(i.base64,'base64')),i.sha256,i.file);assert.equal(hash(fs.readFileSync(i.file)),i.sha256,i.file);}
const baseline=JSON.parse(Buffer.from(packet.files.find(i=>i.file===packet.reportFile).base64,'base64'));
const pins={transpiler:{checkout:compiler,commit:'89d3a1b6d3f85683900d330b2d0b82d85bf83d5b'},layaair:{checkout:engine,commit:'7d0e97587611013bea23e8a7bf36e377763f18a7'}};
const verifyPins=()=>{for(const p of Object.values(pins)){assert.equal(cp.execFileSync('git',['rev-parse','HEAD'],{cwd:p.checkout,encoding:'utf8'}).trim(),p.commit);assert.equal(cp.execFileSync('git',['diff','--name-only','HEAD','--','src','utils','package.json','package-lock.json','tsconfig.json'],{cwd:p.checkout,encoding:'utf8'}).trim(),'');}};
verifyPins();require(path.join(compiler,'tests/native-generated-urlrequest-type-tests/verify.cjs'));
const compilerInputs=['src','lib','utils'].flatMap(d=>fs.readdirSync(path.join(compiler,d),{recursive:true}).map(f=>path.join(compiler,d,f)).filter(f=>fs.statSync(f).isFile()).map(file=>({file,sha256:hash(fs.readFileSync(file))})));
const helperInputs=new Map(),oldOut=path.dirname(packet.reportFile);
const rebase=v=>{
 if(Array.isArray(v))return v.map(rebase);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,value])=>[k,rebase(value)]));
 if(typeof v!=='string'||!v.startsWith('../'))return v;
 const absolute=path.resolve(oldOut,v),entry=Object.entries(baseline.pins).find(([,p])=>absolute.startsWith(path.resolve(oldRepo,p.checkout)+path.sep));if(!entry)return v;
 const [key,old]=entry,next=path.resolve(pins[key].checkout,path.relative(path.resolve(oldRepo,old.checkout),absolute)),file=next+'.ts';assert.ok(fs.existsSync(file),file);helperInputs.set(file,{file,sha256:hash(fs.readFileSync(file))});const relative=path.relative(__dirname,next).replaceAll('\\','/');return relative.startsWith('.')?relative:'./'+relative;
};
const input=rebase(baseline.input),options=rebase(baseline.options);assert.deepEqual(input.sources,baseline.input.sources);assert.equal(Object.keys(input.sources).length,1356);assert.deepEqual(input.classScriptSources,baseline.input.classScriptSources);assert.equal(input.classScriptSources.length,95);
options.nativeURLRequestReferenceModule=input.providers['flash.net.URLRequest'].module;
const api=require(path.join(compiler,'lib')),parse=require(path.join(compiler,'lib/parse')),decl=require(path.join(compiler,'lib/emit/native-generated-declarations'));
let plan,planFailure;try{plan=api.createNativeGeneratedDeclarationPlan(input);}catch(e){planFailure=e;}
const imports={...options.importModules};if(plan){[...plan.bindings.map(b=>b.qname),...plan.privateBindings.map(b=>b.identity)].forEach((q,i)=>imports[q]='./__native_class_'+i);decl.nativeGeneratedInterfaceBindings(plan).forEach((b,i)=>imports[b.qname]='./__native_interface_'+i);}
const identity='flashx.textLayout.elements.InlineGraphicElement',source=input.sources[identity].source;let emission;
try{if(planFailure)throw planFailure;const opts={...options,customVisitors:[],importModules:imports,nativeTweenSourcePlans:baseline.tweenSourcePlans[identity],nativeGeneratedDeclarations:{plan,module:'./__native_declarations',declarationIdentity:identity},nativeReferenceCoercion:{...options.nativeReferenceCoercion,plan,module:'./__native_declarations'},nativeVectorTypes:{...options.nativeVectorTypes,plan}};
 const emitted=api.Emitter.emit(parse(identity+'.as',source),source,opts),ts=require(path.join(engine,'node_modules/typescript'));
 const syntaxDiagnostics=ts.createSourceFile('candidate.ts',emitted,ts.ScriptTarget.Latest,true).parseDiagnostics.map(d=>({code:d.code,start:d.start,text:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
 emission={identity,status:'emitted',source:emitted,sourceSha256:hash(source),syntaxDiagnostics};
}catch(e){emission={identity,status:'held',phase:planFailure?'plan':'emission',sourceSha256:hash(source),message:e.message,stack:String(e.stack)};}
verifyPins();for(const i of [...compilerInputs,...helperInputs.values()])assert.equal(hash(fs.readFileSync(i.file)),i.sha256,i.file);
const report={pins,input,options,sourceCount:1356,classScriptCount:95,emission,sourceInputs:baseline.sourceInputs,compilerInputs,helperInputs:[...helperInputs.values()],baseline:{file:archive,sha256:hash(bytes)},tool:{file:__filename,sha256:hash(fs.readFileSync(__filename))},factory:'not-run',typeCheck:'not-run',runtime:'not-run',providerPromotion:false};
const output=path.join(__dirname,'original-replay-report.json.gz');assert.ok(!fs.existsSync(output));fs.writeFileSync(output,z.gzipSync(JSON.stringify(report),{level:9}));
console.log(JSON.stringify({output,identity,status:emission.status,characters:emission.source?.length,message:emission.message}));
