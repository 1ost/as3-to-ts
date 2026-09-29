'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('class Event metadata retains original source and class members without synthetic dispatch',t=>{
 const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;assert.ok(air&&laya&&ffdec);
 const fixture=process.env.HARDENED_FIXTURE_SOURCE||path.join(laya,'tests/nativeFlashOracle/class-event-metadata');
 const retained=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json')));
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'class-event-metadata-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,'source'),profile=path.join(dir,'profile');fs.mkdirSync(source);
 const names=['AnnotatedEventSubject','PlainEventSubject','ClassEventMetadataProbe'];
 for(const name of names){const bytes=fs.readFileSync(path.join(fixture,name+'.as'));assert.equal(sha(bytes),retained.sourceFiles[name+'.as']);fs.writeFileSync(path.join(source,name+'.as'),bytes);}
 assert.equal(sha(fs.readFileSync(path.join(fixture,'scenario.json'))),retained.scenarioSha256);
 const run=(cmd,args)=>{const r=cp.spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);};
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','ClassEventMetadataProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);
 const compile=(op,out)=>run(process.execPath,['bin/as3-frontend',op,source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
 make();const snapshots=[];const ts=require('typescript-4-9');
 for(const out of ['first','second']){
  compile('transpile',out);const rows=JSON.parse(fs.readFileSync(path.join(dir,out,'manifest.json'))).files;assert.equal(rows.length,3);const codes=[];
  for(const name of names){assert.equal(rows.find(r=>r.sourcePath===name+'.as')?.sourceSha256,retained.sourceFiles[name+'.as']);const code=fs.readFileSync(path.join(dir,out,'__as3_runtime/application',name+'.ts'),'utf8');codes.push(code);
   if(name==='ClassEventMetadataProbe')continue;
   const tree=ts.createSourceFile(name+'.ts',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);const cls=tree.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text===name);assert.ok(cls);
   assert.deepEqual(cls.members.filter(m=>!ts.isConstructorDeclaration(m)).map(m=>m.name.getText(tree)).sort(),['advance','send','value']);
   assert.equal((ts.getDecorators(cls)||[]).length,0);
   const advance=cls.members.find(m=>m.name?.getText(tree)==='advance');const calls=[];const visit=n=>{if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='dispatchEvent')calls.push(n);ts.forEachChild(n,visit);};visit(advance);assert.equal(calls.length,0);
   assert.doesNotMatch(code,/asyncDecodeError|decodeComplete|@Event\b/);
  }
  snapshots.push([rows,codes]);
 }
 assert.deepEqual(snapshots[0],snapshots[1]);for(const name of names)assert.equal(sha(fs.readFileSync(path.join(source,name+'.as'))),retained.sourceFiles[name+'.as']);
 const forms={Bare:'[Event]',Missing:'[Event(name="x")]',Computed:'[Event(name=NAME,type="flash.events.Event")]',Extra:'[Event(name="x",type="flash.events.Event",other="x")]',Unknown:'[Other(name="x",type="flash.events.Event")]'};
 for(const [name,annotation] of Object.entries(forms))fs.writeFileSync(path.join(source,name+'.as'),`package {${annotation} public class ${name} {}}`);
 fs.rmSync(profile,{recursive:true,force:true});make();compile('qualify','negative');const rows=JSON.parse(fs.readFileSync(path.join(dir,'negative/manifest.json'))).files;
 for(const name of Object.keys(forms)){const row=rows.find(r=>r.sourcePath===name+'.as');assert.equal(row?.status,'held',JSON.stringify(row));assert.equal(row.code,'HARDENED_CLASS_EVENT_METADATA',JSON.stringify(row));}
});
