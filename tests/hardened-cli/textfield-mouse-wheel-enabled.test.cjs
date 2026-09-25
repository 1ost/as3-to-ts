'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const laya=process.env.FROZEN_LAYA_ROOT||process.env.HARDENED_FIXTURE_LAYA,sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('retained Flash 26 scalar receipt proves mouseWheelEnabled ignored-write readback',{skip:!laya},()=>{
 const root=path.join(laya,'tests/flashTextFieldWheel/property-contract/scalar');
 const source=fs.readFileSync(path.join(root,'RunMain.as')),capture=fs.readFileSync(path.join(root,'result.json')),provenance=fs.readFileSync(path.join(root,'result.provenance.json'));
 assert.equal(sha(source),'4dee21309eeaa35742d3da9bfd5f8b8514cf635a770f22a4e984ddbb06f69b5e');
 assert.equal(sha(capture),'b8b3ecaac338dbdb867e42cb30d55688d787bf2fc432c2bb7132bb52293370b2');
 assert.equal(sha(provenance),'8b90ed284355f0135c70ab9cea1f578e93e60673c56abf8b38addf732dc522dc');
 const observations=JSON.parse(capture).observations;
 assert.deepEqual(observations.map(row=>row.phase),['fresh','true','false','true-again']);
 assert.deepEqual(observations.map(row=>row.value),[false,false,false,false]);
 assert.ok(Object.values(JSON.parse(provenance)).includes(sha(source)));
});

test('TextField mouseWheelEnabled requires the exact source-shaped ignored-write bridge',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'textfield-mouse-wheel-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const bundle=path.join(dir,'ledger.cjs');require('esbuild').buildSync({entryPoints:[path.resolve(__dirname,'../../src/hardened/ledger.ts')],outfile:bundle,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
 const {selectCapabilityCandidates:select}=require(bundle);
 function run(access,alter=()=>{}){
  const write=access==='write',signature=write?'public function set mouseWheelEnabled(value:Boolean) : void':'public function get mouseWheelEnabled() : Boolean';
  const mapping={sourceQName:'flash.text.TextField',sourceRoles:['instance-member'],sourceMember:{access,name:'mouseWheelEnabled',minArgs:write?1:0,maxArgs:write?1:0,signature},targetCapabilityId:'api.flash.text',targetExport:'TextField',targetKind:'class',targetModule:'src/layaAir/flash/text/TextField.ts',targetSignature:'typeof TextField',targetMember:{kind:'get+set',name:'mouseWheelEnabled',scope:'instance',signature:'boolean'}};
  alter(mapping);
  const source={as3SourceCapabilities:{apis:[{qname:mapping.sourceQName,classification:'layaair-flash-api-bridge',roles:['instance-member'],preserve:{apiName:true,signature:true}}],memberUses:[{qname:mapping.sourceQName,member:'mouseWheelEnabled',access,classification:'layaair-flash-api-bridge',context:'instance-member',receiverType:mapping.sourceQName,argumentCount:null,preserveNameAndSignature:true,signatures:[{signature,minArgs:write?1:0,maxArgs:write?1:0,declaredBy:mapping.sourceQName,kind:write?'set':'get',static:false,returnType:write?'void':'Boolean'}]}]}};
  const target={schema:'laya-authored-content-capabilities@1',capabilities:[{id:mapping.targetCapabilityId,status:'typescript-obligation',obligations:[{module:mapping.targetModule,export:mapping.targetExport,kind:mapping.targetKind,signature:mapping.targetSignature,constructors:['new (): TextField'],members:[mapping.targetMember]}]}]};
  return select(JSON.stringify(source),JSON.stringify(target),JSON.stringify({schema:'as3-source-to-laya-capability-map@1',mappings:[mapping]}));
 }
 for(const access of ['read','write']) assert.equal(run(access).mappings.length,1,access);
 const hostile=[
  m=>m.sourceRoles.push('constructor'),m=>m.sourceMember.signature='public function set mouseWheelEnabled(value:Object) : void',
  m=>m.sourceMember.minArgs=0,m=>m.sourceMember.maxArgs=2,m=>m.targetCapabilityId='api.other',
  m=>m.targetModule='other/TextField.ts',m=>m.targetExport='OtherTextField',m=>m.targetKind='interface',
  m=>m.targetMember.name='enabled',m=>m.targetMember.kind='property',m=>m.targetMember.scope='static',
  m=>m.targetMember.signature='unknown',
 ];
 for(const [index,alter] of hostile.entries()) assert.equal(run('write',alter).mappings.length,0,'hostile '+index);
});
