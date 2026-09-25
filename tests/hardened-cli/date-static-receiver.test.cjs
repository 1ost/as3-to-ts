'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('native Date instance dispatch preserves authenticated Endian static lookup and rejects unsupported Date members',t=>{
 const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;assert.ok(air&&laya&&ffdec);
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'date-static-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const source=path.join(dir,'source'),profile=path.join(dir,'profile');fs.mkdirSync(source);
 const texts={StaticEndian:'package { import flash.utils.Endian; public class StaticEndian { public function run():String { var date:Date=new Date(); var n:Number=date.getTime(); return Endian.LITTLE_ENDIAN; } } }',
 UnsupportedDate:'package { import flash.utils.Endian; public class UnsupportedDate { public function run(date:Date):Number { var order:String=Endian.LITTLE_ENDIAN; return date.getFullYear(); } } }'};
 for(const [name,text] of Object.entries(texts))fs.writeFileSync(path.join(source,name+'.as'),text);
 const run=(cmd,args)=>{const r=cp.spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);};
 run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','StaticEndian','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--native-date','--output',profile]);
 run(process.execPath,['bin/as3-frontend','qualify',source,path.join(dir,'qualified'),'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
 const rows=JSON.parse(fs.readFileSync(path.join(dir,'qualified/manifest.json'))).files;
 for(const [name,text] of Object.entries(texts))assert.equal(rows.find(row=>row.sourcePath===name+'.as').sourceSha256,sha(text));
 assert.equal(rows.find(row=>row.sourcePath==='StaticEndian.as').status,'admitted',JSON.stringify(rows));
 assert.equal(rows.find(row=>row.sourcePath==='UnsupportedDate.as').code,'HARDENED_DATE_MEMBER',JSON.stringify(rows));
});
