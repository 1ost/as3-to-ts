'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;
const boundedEvidenceRevision='575b82f69e3037c97be4115eec18f19f0d37fd53';

test('RegExp source-bound fixtures preserve contracts and deterministic output',t=>{
 assert.ok(air&&laya&&ffdec,'AIR, Laya and FFDec paths required');
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'regexp-literal-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,'source'),profile=path.join(dir,'profile');fs.mkdirSync(source);
 const hashes=new Map();
 const retained=cp.spawnSync('git',['merge-base','--is-ancestor',boundedEvidenceRevision,'HEAD'],{cwd:laya,encoding:'utf8'});
 assert.equal(retained.status,0,retained.stderr||'bounded RegExp evidence revision is not retained');
 for(const [folder,name] of [['regexp-config-patterns','RegExpConfigPatternsProbe'],['regexp-anchor-newlines','RegExpAnchorNewlinesProbe'],
  ['regexp-bounded-character-class','RegExpBoundedCharacterClassProbe']]) {
  const fixture=path.join(process.env.HARDENED_FIXTURE_SOURCE||path.join(laya,'tests/nativeFlashOracle'),folder);
  const evidence=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'))),bytes=fs.readFileSync(path.join(fixture,name+'.as'));
  assert.equal(sha(bytes),evidence.sourceFiles[name+'.as']);
  assert.equal(sha(fs.readFileSync(path.join(fixture,'scenario.json'))),evidence.scenarioSha256||evidence.sourceFiles['scenario.json']);
  fs.writeFileSync(path.join(source,name+'.as'),bytes);hashes.set(name+'.as',sha(bytes));
 }
 const run=(command,args)=>{const r=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);};
 const make=(shared=false)=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','RegExpConfigPatternsProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile,...(shared?['--native-regexp']:[])]);
 const compile=(op,out)=>run(process.execPath,['bin/as3-frontend',op,source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
 make();const snapshots=[];
 for(const out of ['first','second']){
  compile('transpile',out);const rows=JSON.parse(fs.readFileSync(path.join(dir,out,'manifest.json'))).files;assert.equal(rows.length,3);
  const codes=[];for(const [file,hash] of hashes){assert.equal(rows.find(row=>row.sourcePath===file)?.sourceSha256,hash);
   const code=fs.readFileSync(path.join(dir,out,'__as3_runtime/application',file.replace('.as','.ts')),'utf8');
   assert.match(code,/__as3RegExpTest/);
   if(file==='RegExpBoundedCharacterClassProbe.as') {
    assert.match(code,/__as3RegExpTest\("\/\^\[A-Za-z0-9\._-\]\{1,64\}\$\/", this\.counted\(value\)\)/);
   } else assert.match(code,/__as3RegExpReplaceReceiver/);
   assert.match(code,new RegExp('class '+file.replace('.as','')));codes.push(code);
  }
  const packageRoot=path.join(dir,out,'__as3_runtime');
  const packageInfo=JSON.parse(fs.readFileSync(path.join(packageRoot,'package.json')));
  const fromPackage=require('node:module').createRequire(path.join(packageRoot,'application/RegExpConfigPatternsProbe.js'));
  // Use Node's actual self-reference/export resolver, not a synthetic path mapping.
  // Every generated runtime import must resolve inside the published package files.
  for(const file of hashes.keys()) {
   const js=fs.readFileSync(path.join(packageRoot,'application',file.replace('.as','.js')),'utf8');
   for(const match of js.matchAll(/require\("([^"]+)"\)/g)) {
    const specifier=match[1];if(!specifier.startsWith(packageInfo.name+'/'))continue;
    const resolved=fromPackage.resolve(specifier);
    assert.equal(path.dirname(resolved),packageRoot);assert.ok(fs.existsSync(resolved));
    assert.ok(packageInfo.files.includes(path.basename(resolved)));
   }
  }
  const runtime=fromPackage(packageInfo.name+'/AS3RegExp');
  assert.equal(typeof runtime.as3RegExpTest,'function');
  assert.equal(typeof runtime.as3RegExpReplaceReceiver,'function');
  assert.equal(runtime.as3RegExpTest('/^a$/','a\n'),true);
  assert.equal(runtime.as3RegExpReplaceReceiver('assets_en/next')('/assets_(?:en|cn)(?=\\/|$)/','assets'),'assets/next');
  const application=fromPackage(path.join(packageRoot,'ApplicationEntry.generated.js')),
   Probe=application.AS3_APPLICATION_MODULES.find(module=>module.RegExpBoundedCharacterClassProbe).RegExpBoundedCharacterClassProbe,
   probe=new Probe(),boundedFixture=path.join(laya,'tests/nativeFlashOracle/regexp-bounded-character-class'),
   scenario=JSON.parse(fs.readFileSync(path.join(boundedFixture,'scenario.json'))),
   native=JSON.parse(fs.readFileSync(path.join(boundedFixture,'native-air.json')));
  for(const [index,step] of scenario.steps.entries()) {
   for(const call of step.calls) probe[call.method](...call.args);
   assert.deepEqual(probe.result,native.capture.state.observations[index].result,step.id);
  }
  snapshots.push([rows,codes]);
 }
 assert.deepEqual(snapshots[0],snapshots[1]);for(const [file,hash] of hashes)assert.equal(sha(fs.readFileSync(path.join(source,file))),hash);
 // Enabling first-class RegExp must retain the already evidenced fused
 // lookahead/alternation operation used by the original AP Config source.
 fs.rmSync(profile,{recursive:true,force:true});make(true);compile('transpile','with-shared-provider');
 const sharedRows=JSON.parse(fs.readFileSync(path.join(dir,'with-shared-provider/manifest.json'))).files;
 assert.equal(sharedRows.length,3);
 for(const [file,hash] of hashes)assert.equal(sharedRows.find(row=>row.sourcePath===file)?.sourceSha256,hash);
 assert.match(fs.readFileSync(path.join(dir,'with-shared-provider/__as3_runtime/application/RegExpConfigPatternsProbe.ts'),'utf8'),/__as3RegExpReplaceReceiver/);
 const negatives={Flag:'/a/g',Capture:'/(a)/',Wildcard:'/a./',Backreference:'/(a)\\1/',Negated:' /[^a]/',Quantifier:'/a+/',Lookbehind:'/(?<=a)b/',
  Bound63:'/^[A-Za-z0-9._-]{1,63}$/',BoundZero:'/^[A-Za-z0-9._-]{0,64}$/',Bound65:'/^[A-Za-z0-9._-]{1,65}$/',
  BoundOpen:'/^[A-Za-z0-9._-]{1,}$/',BoundMissing:'/^[A-Za-z0-9._-]{,64}$/',BoundLazy:'/^[A-Za-z0-9._-]{1,64}?$/',
  BoundOtherClass:'/^[A-Za-z0-9._]{1,64}$/',BoundNested:'/^(?:[A-Za-z0-9._-]){1,64}$/',
  BoundFlag:'/^[A-Za-z0-9._-]{1,64}$/g'};
 for(const [name,pattern] of Object.entries(negatives))fs.writeFileSync(path.join(source,name+'.as'),`package {public class ${name} {public function run(value:String):Boolean {return ${pattern}.test(value);}}}`);
 fs.writeFileSync(path.join(source,'BoundedCoercion.as'),'package {public class BoundedCoercion {public function run(value:Number):Boolean {return /^[A-Za-z0-9._-]{1,64}$/.test(value);}}}');
 fs.writeFileSync(path.join(source,'BoundedReplace.as'),'package {public class BoundedReplace {public function run(value:String):String {return value.replace(/^[A-Za-z0-9._-]{1,64}$/,"x");}}}');
 fs.rmSync(profile,{recursive:true,force:true});make();compile('qualify','negative');
 const rows=JSON.parse(fs.readFileSync(path.join(dir,'negative/manifest.json'))).files;
 for(const name of Object.keys(negatives)){const row=rows.find(row=>row.sourcePath===name+'.as');assert.equal(row?.status,'held',JSON.stringify(row));assert.equal(row.code,'HARDENED_REGEXP_GRAMMAR',JSON.stringify(row));}
 assert.equal(rows.find(row=>row.sourcePath==='BoundedCoercion.as')?.code,'HARDENED_REGEXP_ARGUMENT');
 assert.equal(rows.find(row=>row.sourcePath==='BoundedReplace.as')?.code,'HARDENED_REGEXP_GRAMMAR');
});
