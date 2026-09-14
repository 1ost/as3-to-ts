'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;

test('RegExp source-bound fixtures preserve contracts and deterministic output',t=>{
 assert.ok(air&&laya&&ffdec,'AIR, Laya and FFDec paths required');
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'regexp-literal-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,'source'),profile=path.join(dir,'profile');fs.mkdirSync(source);
 const hashes=new Map();
 for(const [folder,name] of [['regexp-config-patterns','RegExpConfigPatternsProbe'],['regexp-anchor-newlines','RegExpAnchorNewlinesProbe']]) {
  const fixture=path.join(process.env.HARDENED_FIXTURE_SOURCE||path.join(laya,'tests/nativeFlashOracle'),folder);
  const evidence=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'))),bytes=fs.readFileSync(path.join(fixture,name+'.as'));
  assert.equal(sha(bytes),evidence.sourceFiles[name+'.as']);assert.equal(sha(fs.readFileSync(path.join(fixture,'scenario.json'))),evidence.scenarioSha256);
  fs.writeFileSync(path.join(source,name+'.as'),bytes);hashes.set(name+'.as',sha(bytes));
 }
 const run=(command,args)=>{const r=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);};
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','RegExpConfigPatternsProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);
 const compile=(op,out)=>run(process.execPath,['bin/as3-frontend',op,source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
 make();const snapshots=[];
 for(const out of ['first','second']){
  compile('transpile',out);const rows=JSON.parse(fs.readFileSync(path.join(dir,out,'manifest.json'))).files;assert.equal(rows.length,2);
  const codes=[];for(const [file,hash] of hashes){assert.equal(rows.find(row=>row.sourcePath===file)?.sourceSha256,hash);
   const code=fs.readFileSync(path.join(dir,out,'__as3_runtime/application',file.replace('.as','.ts')),'utf8');
   assert.match(code,/__as3RegExpTest/);assert.match(code,/__as3RegExpReplaceReceiver/);assert.match(code,new RegExp('class '+file.replace('.as','')));codes.push(code);
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
  snapshots.push([rows,codes]);
 }
 assert.deepEqual(snapshots[0],snapshots[1]);for(const [file,hash] of hashes)assert.equal(sha(fs.readFileSync(path.join(source,file))),hash);
 const negatives={Flag:'/a/g',Capture:'/(a)/',Wildcard:'/a./',Backreference:'/(a)\\1/',Negated:' /[^a]/',Quantifier:'/a+/',Lookbehind:'/(?<=a)b/'};
 for(const [name,pattern] of Object.entries(negatives))fs.writeFileSync(path.join(source,name+'.as'),`package {public class ${name} {public function run(value:String):Boolean {return ${pattern}.test(value);}}}`);
 fs.rmSync(profile,{recursive:true,force:true});make();compile('qualify','negative');
 const rows=JSON.parse(fs.readFileSync(path.join(dir,'negative/manifest.json'))).files;
 for(const name of Object.keys(negatives)){const row=rows.find(row=>row.sourcePath===name+'.as');assert.equal(row?.status,'held',JSON.stringify(row));assert.equal(row.code,'HARDENED_REGEXP_GRAMMAR',JSON.stringify(row));}
});
