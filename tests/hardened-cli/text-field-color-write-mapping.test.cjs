'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
test('TextField textColor setter requires the exact uint source and shared numeric accessor',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'format-property-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const bundle=path.join(dir,'ledger.cjs');require('esbuild').buildSync({entryPoints:[path.resolve(__dirname,'../../src/hardened/ledger.ts')],outfile:bundle,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
 const {selectCapabilityCandidates:select}=require(bundle);
 function run(name,access,type,sourceType,alter=()=>{}){
  const signature=access==='read'?`public function get ${name}() : ${sourceType}`:`public function set ${name}(value:${sourceType}) : void`;
  const mapping={sourceQName:'flash.text.TextField',sourceRoles:['instance-member'],sourceMember:{access,name,minArgs:access==='read'?0:1,maxArgs:access==='read'?0:1,signature},targetCapabilityId:'api.flash.text',targetExport:'TextField',targetKind:'class',targetModule:'src/layaAir/flash/text/TextField.ts',targetSignature:'typeof TextField',targetMember:{kind:'get+set',name,scope:'instance',signature:type}};alter(mapping);
  const source={as3SourceCapabilities:{apis:[{qname:mapping.sourceQName,classification:'layaair-flash-api-bridge',roles:['instance-member'],preserve:{apiName:true,signature:true}}],memberUses:[{qname:mapping.sourceQName,member:name,access,classification:'layaair-flash-api-bridge',context:'instance-member',receiverType:mapping.sourceQName,argumentCount:null,preserveNameAndSignature:true,signatures:[{signature,minArgs:mapping.sourceMember.minArgs,maxArgs:mapping.sourceMember.maxArgs,declaredBy:mapping.sourceQName,kind:access==='read'?'get':'set',static:false,returnType:access==='read'?sourceType:'void'}]}]}};
  const target={schema:'laya-authored-content-capabilities@1',capabilities:[{id:'api.flash.text',status:'typescript-obligation',obligations:[{module:mapping.targetModule,export:mapping.targetExport,kind:'class',signature:mapping.targetSignature,constructors:['new (): TextField'],members:[mapping.targetMember]}]}]};
  return select(JSON.stringify(source),JSON.stringify(target),JSON.stringify({schema:'as3-source-to-laya-capability-map@1',mappings:[mapping]}));
 }
 for(const [name,type,source] of [['textColor','number','uint'],['backgroundColor','number','uint'],['borderColor','number','uint'],['background','boolean','Boolean'],['border','boolean','Boolean'],['type','string','String']]) for(const access of ['read','write']) assert.equal(run(name,access,type,source).mappings.length,1);
 for(const [name,type,source] of [['textColor','number','Number'],['textColor','number','int'],['textColor','boolean','uint']]){
  assert.equal(run(name,'write',type,source).mappings.length,0,`${name}/${type}/${source}`);
 }
 for(const alter of [m=>m.targetModule='other/TextField.ts',m=>m.targetExport='Other',m=>m.targetMember.name='backgroundColor',m=>m.targetMember.scope='static',m=>m.sourceMember.maxArgs=2]){
  assert.equal(run('textColor','write','number','uint',alter).mappings.length,0);
 }
});
