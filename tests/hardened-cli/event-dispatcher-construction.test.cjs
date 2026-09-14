'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('EventDispatcher subclass forwards authenticated target without exposing pre-super receiver',t=>{
 const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;assert.ok(air&&laya&&ffdec);
 const fixture=process.env.HARDENED_FIXTURE_SOURCE||path.join(laya,'tests/nativeFlashOracle/event-dispatcher-construction');
 const retained=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json')));
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'event-dispatcher-construction-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const source=path.join(dir,'source'),profile=path.join(dir,'profile');fs.mkdirSync(source);
 for(const [name,hash] of Object.entries(retained.sourceFiles)){const bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha(bytes),hash);fs.writeFileSync(path.join(source,name),bytes);}
 assert.equal(sha(fs.readFileSync(path.join(fixture,'scenario.json'))),retained.scenarioSha256);
 const run=(cmd,args)=>{const r=cp.spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);};
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','EventDispatcherConstructionProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);
 const compile=(op,out)=>run(process.execPath,['bin/as3-frontend',op,source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
 make();const snapshots=[];const ts=require('typescript-4-9');
 for(const out of ['first','second']){
  compile('transpile',out);const rows=JSON.parse(fs.readFileSync(path.join(dir,out,'manifest.json'))).files;assert.equal(rows.length,2);const codes=[];
  for(const [name,hash] of Object.entries(retained.sourceFiles)){assert.equal(rows.find(r=>r.sourcePath===name)?.sourceSha256,hash);codes.push(fs.readFileSync(path.join(dir,out,'__as3_runtime/application',name.replace('.as','.ts')),'utf8'));}
  const code=fs.readFileSync(path.join(dir,out,'__as3_runtime/application/DelegatingEventSubject.ts'),'utf8');const tree=ts.createSourceFile('Subject.ts',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);const calls=[];const visit=n=>{if(ts.isCallExpression(n)&&n.expression.kind===ts.SyntaxKind.SuperKeyword)calls.push(n);ts.forEachChild(n,visit);};visit(tree);assert.equal(calls.length,1);assert.equal(calls[0].arguments.length,2);
  let target=calls[0].arguments[0];while(ts.isNonNullExpression(target)||ts.isParenthesizedExpression(target))target=target.expression;assert.ok(ts.isIdentifier(target));assert.equal(target.text,'target');
  const proof=calls[0].arguments[1];assert.ok(ts.isSpreadElement(proof));assert.equal(proof.expression.getText(tree),'__as3PreparedConstruction');
  snapshots.push([rows,codes]);
 }
 assert.deepEqual(snapshots[0],snapshots[1]);
 const negative={Receiver:['','super(this);','HARDENED_SUPER_CONSTRUCTION_RECEIVER'],Extra:['','super(null,null);','HARDENED_CAPABILITY_CALL_ARITY'],Wrong:['','super(1);','HARDENED_CAPABILITY_CALL_TYPE']};
 for(const [name,[parameters,body]] of Object.entries(negative))fs.writeFileSync(path.join(source,name+'.as'),`package {import flash.events.EventDispatcher;public class ${name} extends EventDispatcher {public function ${name}(${parameters}){${body}}}}`);
 fs.rmSync(profile,{recursive:true,force:true});make();compile('qualify','negative');const rows=JSON.parse(fs.readFileSync(path.join(dir,'negative/manifest.json'))).files;
 for(const [name,[,,code]] of Object.entries(negative)){const row=rows.find(r=>r.sourcePath===name+'.as');assert.equal(row?.status,'held',JSON.stringify(row));assert.equal(row.code,code,JSON.stringify(row));}
 for(const [name,hash] of Object.entries(retained.sourceFiles))assert.equal(sha(fs.readFileSync(path.join(source,name))),hash);
});
