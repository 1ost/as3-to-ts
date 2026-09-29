'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;

function canonical(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';}
const writeCanonical=(file,value)=>fs.writeFileSync(file,canonical(value)+'\n');
test('Event and ErrorEvent super calls require exact source/target constructor proof',t=>{
 assert.ok(air&&laya&&ffdec,'AIR, Laya and FFDec paths required');
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'flash-super-event-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,'source'),profile=path.join(dir,'profile'),fixture=process.env.HARDENED_FIXTURE_SOURCE||path.join(laya,'tests/nativeFlashOracle/flash-super-event');fs.mkdirSync(source);
 const retained=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'))),hashes=Object.fromEntries(Object.entries(retained.sourceFiles).filter(([name])=>name.endsWith('.as')));
 assert.equal(Object.keys(hashes).length,3);
 for(const [name,hash] of Object.entries(hashes)){const bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha(bytes),hash);fs.writeFileSync(path.join(source,name),bytes);}
 assert.equal(sha(fs.readFileSync(path.join(fixture,'scenario.json'))),retained.scenarioSha256||retained.sourceFiles['scenario.json']);
 const run=(command,args)=>{const r=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);return r;};
 const make=(extra=[])=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','FlashSuperEventProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile,...extra]);
 const command=(op,out)=>['bin/as3-frontend',op,source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')];
 const compile=(op,out)=>run(process.execPath,command(op,out));
 make();const snapshots=[];
 for(const out of ['first','second']){
  compile('transpile',out);const rows=JSON.parse(fs.readFileSync(path.join(dir,out,'manifest.json'))).files;assert.equal(rows.length,3);const codes=[];
  for(const [name,hash] of Object.entries(hashes)){assert.equal(rows.find(row=>row.sourcePath===name)?.sourceSha256,hash);codes.push(fs.readFileSync(path.join(dir,out,'__as3_runtime/application',name.replace('.as','.ts')),'utf8'));}
  const eventCode=fs.readFileSync(path.join(dir,out,'__as3_runtime/application/SourceEvent.ts'),'utf8'),errorCode=fs.readFileSync(path.join(dir,out,'__as3_runtime/application/SourceErrorEvent.ts'),'utf8');
  const ts=require('typescript-4-9');
  for(const [name,code,arity] of [['SourceEvent',eventCode,3],['SourceErrorEvent',errorCode,5]]){
   const tree=ts.createSourceFile(name+'.ts',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);const calls=[];const visit=node=>{if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.SuperKeyword)calls.push(node);ts.forEachChild(node,visit);};visit(tree);assert.equal(calls.length,1);
   // The emitter appends the existing authenticated construction seam as an
   // empty-tuple spread. It contributes no native constructor arguments.
   const args=calls[0].arguments;assert.equal(args.length,arity+1);
   const seam=args[arity];assert.ok(ts.isSpreadElement(seam));assert.ok(ts.isIdentifier(seam.expression));assert.equal(seam.expression.text,'__as3PreparedConstruction');
   const sourceNames=['type','bubbles','cancelable','text','id'].slice(0,arity);
   for(let i=0;i<arity;i++){
    let argument=args[i];while(ts.isNonNullExpression(argument)||ts.isParenthesizedExpression(argument))argument=argument.expression;
    const coercion={type:'__as3String',bubbles:'__as3Boolean',cancelable:'__as3Boolean',text:'__as3String',id:'__as3Int'}[sourceNames[i]];
    if(ts.isCallExpression(argument)){assert.ok(ts.isIdentifier(argument.expression));assert.equal(argument.expression.text,coercion);assert.equal(argument.arguments.length,1);argument=argument.arguments[0];}
    assert.ok(ts.isIdentifier(argument));assert.equal(argument.text,sourceNames[i]);
   }
   const preparations=[];const findPreparation=node=>{if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.name.text==='__as3PreparedConstruction')preparations.push(node.initializer);ts.forEachChild(node,findPreparation);};findPreparation(tree);
   assert.equal(preparations.length,1);assert.ok(ts.isCallExpression(preparations[0]));assert.equal(preparations[0].expression.getText(tree),'__as3PrepareConstruction');assert.deepEqual(preparations[0].arguments.map(arg=>arg.getText(tree)),['new.target',name,'__as3ConstructionProof']);
   assert.match(code,new RegExp('class '+name+' extends '));
  }
  snapshots.push([rows,codes]);
 }
 assert.deepEqual(snapshots[0],snapshots[1]);for(const [name,hash] of Object.entries(hashes))assert.equal(sha(fs.readFileSync(path.join(source,name))),hash);
 // Mutate a valid generated mapping, preserving canonical/hash envelopes. The compiler,
 // not profile production failure, must reject missing or forged constructor authority.
 const lockFile=path.join(profile,'profile-lock.json'),originalLock=fs.readFileSync(lockFile),lock=JSON.parse(originalLock),mapFile=path.resolve(profile,lock.files.capabilityMapping.path),originalMap=fs.readFileSync(mapFile);
 for(const variant of ['missing-event','forged-error-signature']){
  const map=JSON.parse(originalMap);const row=map.mappings.find(row=>row.sourceQName===(variant==='missing-event'?'flash.events.Event':'flash.events.ErrorEvent')&&row.sourceMember?.name===(variant==='missing-event'?'Event':'ErrorEvent'));assert.ok(row,'Exact constructor mapping was generated');
  if(variant==='missing-event')map.mappings.splice(map.mappings.indexOf(row),1);else row.targetMember.signature='new (type: number): ErrorEvent';
  writeCanonical(mapFile,map);const changed=JSON.parse(originalLock);changed.files.capabilityMapping.sha256=sha(fs.readFileSync(mapFile));writeCanonical(lockFile,changed);
  for(const [name,pin] of Object.entries(changed.files))assert.equal(sha(fs.readFileSync(path.resolve(profile,pin.path))),pin.sha256,name);
  const result=cp.spawnSync(process.execPath,command('qualify',variant),{cwd:root,encoding:'utf8',timeout:120000});
  if(result.status===0){const rows=JSON.parse(fs.readFileSync(path.join(dir,variant,'manifest.json'))).files;const expected=variant==='missing-event'?'SourceEvent.as':'SourceErrorEvent.as';const row=rows.find(row=>row.sourcePath===expected);assert.equal(row?.status,'held',JSON.stringify(row));assert.ok(/AUTHORITY|CAPABILITY|SIGNATURE/.test(row.code),JSON.stringify(row));}
  else {assert.notEqual(result.status,null);assert.match(result.stdout+result.stderr,/constructor|capability|signature|mapping/i);}
  fs.writeFileSync(mapFile,originalMap);fs.writeFileSync(lockFile,originalLock);
 }
 // A valid alternate route keeps the graph connected, but cannot substitute for
 // the direct constructor dependency. All three retained sources stay unchanged.
 fs.rmSync(profile,{recursive:true,force:true});
 make(['--omit-direct-edge','FlashSuperEventProbe:SourceEvent']);
 compile('qualify','missing-local-edge');
 const edgeRows=JSON.parse(fs.readFileSync(path.join(dir,'missing-local-edge/manifest.json'))).files;
 const edgeRow=edgeRows.find(row=>row.sourcePath==='FlashSuperEventProbe.as');
 assert.equal(edgeRow?.status,'held',JSON.stringify(edgeRow));
 assert.equal(edgeRow.code,'HARDENED_LOCAL_IMPORT_EDGE',JSON.stringify(edgeRow));
 // The first method caches the legitimate same-package import; the second must
 // still reject its lexical value shadow instead of constructing the class.
 fs.writeFileSync(path.join(source,'ShadowedConstructor.as'),`package {public class ShadowedConstructor {
 public function first():Object {return new SourceEvent("first");}
 public function second(SourceEvent:*):Object {return new SourceEvent("second");}
 }}`);
 const negatives={NoArgs:'super();',ExtraArgs:'super("x",false,false,1);',WrongType:'super(42);'};
 for(const [name,body] of Object.entries(negatives))fs.writeFileSync(path.join(source,name+'.as'),`package {import flash.events.Event;public class ${name} extends Event {public function ${name}(){${body}}}}`);
 fs.rmSync(profile,{recursive:true,force:true});make();compile('qualify','negative');const rows=JSON.parse(fs.readFileSync(path.join(dir,'negative/manifest.json'))).files;
 const shadow=rows.find(row=>row.sourcePath==='ShadowedConstructor.as');assert.equal(shadow?.status,'held',JSON.stringify(shadow));assert.equal(shadow.code,'HARDENED_NEW_SHADOW',JSON.stringify(shadow));
 for(const name of Object.keys(negatives)){const row=rows.find(row=>row.sourcePath===name+'.as');assert.equal(row?.status,'held',JSON.stringify(row));assert.equal(row.code,name==='WrongType'?'HARDENED_CAPABILITY_CALL_TYPE':'HARDENED_CAPABILITY_CALL_ARITY',JSON.stringify(row));}
});
