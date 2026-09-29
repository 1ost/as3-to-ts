'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');

test('TextField input controls require exact source-shaped LayaAir properties',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'textfield-input-controls-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const bundle=path.join(dir,'ledger.cjs');require('esbuild').buildSync({entryPoints:[path.resolve(__dirname,'../../src/hardened/ledger.ts')],outfile:bundle,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
 const {selectCapabilityCandidates:select}=require(bundle);
 const types={displayAsPassword:['Boolean','boolean'],maxChars:['int','number'],restrict:['String','string']};
 function run(name,access,alter=()=>{}){
  const write=access==='write',[sourceType,targetType]=types[name];
  const signature=write?`public function set ${name}(value:${sourceType}) : void`:`public function get ${name}() : ${sourceType}`;
  const mapping={sourceQName:'flash.text.TextField',sourceRoles:['instance-member'],sourceMember:{access,name,minArgs:write?1:0,maxArgs:write?1:0,signature},targetCapabilityId:'api.flash.text',targetExport:'TextField',targetKind:'class',targetModule:'src/layaAir/flash/text/TextField.ts',targetSignature:'typeof TextField',targetMember:{kind:'get+set',name,scope:'instance',signature:targetType}};
  alter(mapping);
  const source={as3SourceCapabilities:{apis:[{qname:mapping.sourceQName,classification:'layaair-flash-api-bridge',roles:['instance-member'],preserve:{apiName:true,signature:true}}],memberUses:[{qname:mapping.sourceQName,member:name,access,classification:'layaair-flash-api-bridge',context:'instance-member',receiverType:mapping.sourceQName,argumentCount:null,preserveNameAndSignature:true,signatures:[{signature,minArgs:write?1:0,maxArgs:write?1:0,declaredBy:mapping.sourceQName,kind:write?'set':'get',static:false,returnType:write?'void':sourceType}]}]}};
  const target={schema:'laya-authored-content-capabilities@1',capabilities:[{id:mapping.targetCapabilityId,status:'typescript-obligation',obligations:[{module:mapping.targetModule,export:mapping.targetExport,kind:mapping.targetKind,signature:mapping.targetSignature,constructors:['new (): TextField'],members:[mapping.targetMember]}]}]};
  return select(JSON.stringify(source),JSON.stringify(target),JSON.stringify({schema:'as3-source-to-laya-capability-map@1',mappings:[mapping]}));
 }
 for(const name of Object.keys(types))for(const access of ['read','write'])assert.equal(run(name,access).mappings.length,1,`${name} ${access}`);
 const hostile=[
  m=>m.sourceRoles.push('constructor'),m=>m.sourceMember.signature='public function set restrict(value:Object) : void',
  m=>m.sourceMember.minArgs=0,m=>m.sourceMember.maxArgs=2,m=>m.targetCapabilityId='api.other',
  m=>m.targetModule='other/TextField.ts',m=>m.targetExport='OtherTextField',m=>m.targetKind='interface',
  m=>m.targetSignature='typeof OtherTextField',m=>m.targetMember.name='other',m=>m.targetMember.kind='property',
  m=>m.targetMember.scope='static',m=>m.targetMember.signature='unknown',
 ];
 for(const [index,alter] of hostile.entries())assert.equal(run('restrict','write',alter).mappings.length,0,'hostile '+index);
 assert.equal(run('restrict','call').mappings.length,0,'call access');
});
