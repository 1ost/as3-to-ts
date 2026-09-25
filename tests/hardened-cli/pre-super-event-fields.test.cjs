'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const air=process.env.HARDENED_FIXTURE_AIR_SDK;
const laya=process.env.HARDENED_FIXTURE_LAYA;
const ffdec=process.env.HARDENED_FIXTURE_FFDEC;

test('native Event stages only own pre-super slots and retains its constructor order',async t=>{
 assert.ok(air&&laya&&ffdec,'AIR, Laya and FFDec paths required');
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'pre-super-event-fields-')));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,'source'),profile=path.join(dir,'profile');fs.mkdirSync(source);
 const cases={
  GoodEvent:'private var payload:Object; public function GoodEvent(value:Object=null){this.payload=value; super("ready");} public function getPayload():Object{return this.payload;}',
  BadMethod:'private var payload:Object; public function BadMethod(){this.helper(); super("ready");} private function helper():void{}',
  BadSelf:'private var self:Object=this; public function BadSelf(){this.self=null; super("ready");}',
  BadInherited:'public function BadInherited(){var prior:String=this.type; super("ready");}'
 };
 for(const [name,body] of Object.entries(cases))fs.writeFileSync(path.join(source,name+'.as'),
  `package {import flash.events.Event;public class ${name} extends Event {${body}}}\n`);
 const run=(command,args)=>{
  const result=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000});
  assert.equal(result.status,0,result.stdout+result.stderr);return result;
 };
 run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','GoodEvent',
  '--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);
 const flags=['--source-census',path.join(profile,'census.json'),'--target-capabilities',
  path.join(laya,'docTool/architecture/authored-content-capabilities.json'),
  '--profile-lock',path.join(profile,'profile-lock.json')];
 const qualified=path.join(dir,'qualified');
 run(process.execPath,['bin/as3-frontend','qualify',source,qualified,...flags]);
 const rows=JSON.parse(fs.readFileSync(path.join(qualified,'manifest.json'),'utf8')).files;
 assert.equal(rows.find(row=>row.sourcePath==='GoodEvent.as')?.status,'admitted');
 for(const name of ['BadMethod','BadSelf','BadInherited'])
  assert.equal(rows.find(row=>row.sourcePath===name+'.as')?.code,'HARDENED_SUPER_FIELD_RECEIVER',name);

 const good=path.join(dir,'good');fs.mkdirSync(good);fs.copyFileSync(path.join(source,'GoodEvent.as'),path.join(good,'GoodEvent.as'));
 const goodProfile=path.join(dir,'good-profile');
 run('python3',['-B','tools/create-fixture-profile.py','--source',good,'--entry','GoodEvent',
  '--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',goodProfile]);
 const goodFlags=['--source-census',path.join(goodProfile,'census.json'),'--target-capabilities',
  path.join(laya,'docTool/architecture/authored-content-capabilities.json'),
  '--profile-lock',path.join(goodProfile,'profile-lock.json')];
 const output=path.join(dir,'output');
 run(process.execPath,['bin/as3-frontend','transpile',good,output,...goodFlags]);
 const runtime=path.join(output,'__as3_runtime');
 const code=fs.readFileSync(path.join(runtime,'application/GoodEvent.ts'),'utf8');
 const staged=code.match(/__as3PreSuperFields\.[^\n;]+ = value;/)?.[0];
 const installed=code.match(/this\.[^\n;]+ = __as3PreSuperFields\.[^\n;]+;/)?.[0];
 assert.ok(staged&&installed,code);
 assert.ok(code.indexOf(staged)<code.indexOf('super('),code);
 assert.ok(code.indexOf(installed)>code.indexOf('super('),code);
 const esbuild=require('esbuild');
 const entry=`import {startAS3Application} from ${JSON.stringify(path.join(runtime,'ApplicationEntry.generated.js'))};
const initial=startAS3Application(new AbortController().signal);
const input={label:'payload'};const item=new initial.constructor(input);
globalThis.eventFields=[initial.type,initial.getPayload(),item.type,item.getPayload()===input];`;
 const built=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'ts'},bundle:true,
  alias:{'laya/flash/events/Event':path.join(laya,'src/layaAir/flash/events/Event.ts')},
  write:false,format:'iife',platform:'browser',target:'es2020'});
 const actual=new Function(built.outputFiles[0].text+';return globalThis.eventFields;')();
 assert.deepEqual(actual,['ready',null,'ready',true]);
});
