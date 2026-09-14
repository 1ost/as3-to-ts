'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;

test('explicit getter binding preserves native class contract and source bytes',t=>{
 assert.ok(air&&laya&&ffdec,'AIR, Laya and FFDec paths required');
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'bindable-event-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,'source'),profile=path.join(dir,'profile'),fixture=process.env.HARDENED_FIXTURE_SOURCE||path.join(laya,'tests/nativeFlashOracle/bindable-explicit-event/behavior');fs.mkdirSync(source);
 const retained=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'))),name='BindableExplicitEventProbe.as',bytes=fs.readFileSync(path.join(fixture,name));
 assert.equal(sha(bytes),retained.sourceFiles[name]);assert.equal(sha(fs.readFileSync(path.join(fixture,'scenario.json'))),retained.scenarioSha256);fs.writeFileSync(path.join(source,name),bytes);
 const run=(command,args)=>{const r=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);};
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','BindableExplicitEventProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);
 const compile=(op,out)=>run(process.execPath,['bin/as3-frontend',op,source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
 make();const outputs=[];
 for(const out of ['first','second']) {
  compile('transpile',out);const manifest=JSON.parse(fs.readFileSync(path.join(dir,out,'manifest.json')));assert.equal(manifest.files.length,1);assert.equal(manifest.files[0].sourceSha256,sha(bytes));
  const code=fs.readFileSync(path.join(dir,out,'__as3_runtime/application/BindableExplicitEventProbe.ts'),'utf8');
  const ts=require('typescript-4-9');
  const tree=ts.createSourceFile('BindableExplicitEventProbe.ts',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const declaration=tree.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text==='BindableExplicitEventProbe');
  assert.ok(declaration,'Original class declaration is preserved');
  const members=declaration.members.filter(member=>!ts.isConstructorDeclaration(member));
  assert.deepEqual(members.map(member=>member.name?.getText(tree)).sort(),['currentFrame','events','exercise','frame','observed','onFrame','reads','result'].sort());
  assert.equal(members.filter(member=>ts.isGetAccessorDeclaration(member)&&member.name.getText(tree)==='currentFrame').length,1);
  assert.equal(members.filter(member=>ts.isSetAccessorDeclaration(member)).length,0);
  for(const member of declaration.members) assert.equal(ts.canHaveDecorators(member)?(ts.getDecorators(member)||[]).length:0,0,'No synthesized binding decorators');
  assert.equal(ts.canHaveDecorators(declaration)?(ts.getDecorators(declaration)||[]).length:0,0);
  assert.doesNotMatch(code,/propertyChange|bindingChange|@Bindable\b/);
  outputs.push([manifest.files,code]);
 }
 assert.deepEqual(outputs[0],outputs[1]);assert.equal(sha(fs.readFileSync(path.join(source,name))),sha(bytes));
 const forms={Bare:'[Bindable]',Unknown:'[Other(event="ready")]',Extra:'[Bindable(event="ready",other="x")]',Empty:'[Bindable(event="")]',Computed:'[Bindable(event=EVENT)]',Static:'[Bindable(event="ready")] public static function get value():int{return 1;}',Setter:'[Bindable(event="ready")] public function set value(v:int):void{}',Method:'[Bindable(event="ready")] public function value():int{return 1;}'};
 for(const [cls,form] of Object.entries(forms)) {
  const member=form.includes('function')?form:form+' public function get value():int{return 1;}';
  fs.writeFileSync(path.join(source,cls+'.as'),`package {public class ${cls} {private static const EVENT:String="ready"; ${member}}}`);
 }
 fs.rmSync(profile,{recursive:true,force:true});make();compile('qualify','negative');
 const rows=JSON.parse(fs.readFileSync(path.join(dir,'negative/manifest.json'))).files;
 for(const cls of Object.keys(forms)){const row=rows.find(row=>row.sourcePath===cls+'.as');assert.equal(row?.status,'held',JSON.stringify(row));assert.equal(row.code,'HARDENED_BINDABLE_METADATA',JSON.stringify(row));}
});
