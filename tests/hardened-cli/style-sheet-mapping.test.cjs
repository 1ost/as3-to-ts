'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),test=require('node:test');
test('stylesheet mappings require canonical source and target contracts',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stylesheet-mapping-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const out=path.join(dir,'ledger.cjs');require('esbuild').buildSync({entryPoints:[path.resolve(__dirname,'../../src/hardened/ledger.ts')],outfile:out,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
 const {selectCapabilityCandidates}=require(out);
 const parse={sourceQName:'flash.text.StyleSheet',sourceRoles:['instance-member'],sourceMember:{name:'parseCSS',access:'call',signature:'public function parseCSS(value:String) : void',minArgs:1,maxArgs:1},targetCapabilityId:'api.flash.text',targetModule:'src/layaAir/flash/text/StyleSheet.ts',targetExport:'StyleSheet',targetKind:'class',targetSignature:'typeof StyleSheet',targetMember:{name:'parseCSS',kind:'method',scope:'instance',signature:'(CSSText: string) => void'}};
 const property=write=>({sourceQName:'flash.text.TextField',sourceRoles:['instance-member'],sourceMember:{name:'styleSheet',access:write?'write':'read',signature:write?'public function set styleSheet(value:flash.text.StyleSheet) : void':'public function get styleSheet() : flash.text.StyleSheet',minArgs:write?1:0,maxArgs:write?1:0},targetCapabilityId:'api.flash.text',targetModule:'src/layaAir/flash/text/TextField.ts',targetExport:'TextField',targetKind:'class',targetSignature:'typeof TextField',targetMember:{name:'styleSheet',kind:'get+set',scope:'instance',signature:'StyleSheet'}});
 const select=c=>{
  const m=c.sourceMember,kind=m.access==='call'?'method':m.access==='read'?'get':'set';
  const source={as3SourceCapabilities:{apis:[{qname:c.sourceQName,classification:'layaair-flash-api-bridge',roles:c.sourceRoles,preserve:{apiName:true,signature:true}}],memberUses:[{qname:c.sourceQName,member:m.name,access:m.access,classification:'layaair-flash-api-bridge',argumentCount:m.access==='call'?m.minArgs:null,context:'instance-member',receiverType:c.sourceQName,preserveNameAndSignature:true,signatures:[{signature:m.signature,minArgs:m.minArgs,maxArgs:m.maxArgs,declaredBy:c.sourceQName,kind,static:false,returnType:m.signature.split(' : ').at(-1)}]}]}};
  const target={schema:'laya-authored-content-capabilities@1',capabilities:[{id:c.targetCapabilityId,status:'typescript-obligation',obligations:[{module:c.targetModule,export:c.targetExport,kind:c.targetKind,signature:c.targetSignature,constructors:[],members:[c.targetMember]}]}]};
  return selectCapabilityCandidates(JSON.stringify(source),JSON.stringify(target),JSON.stringify({schema:'as3-source-to-laya-capability-map@1',mappings:[c]}));
 };
 for(const candidate of [parse,property(false),property(true)]){
  assert.deepEqual(select(candidate).mappings,[candidate]);
  for(const mutate of [c=>c.targetCapabilityId='api.flash.display',c=>c.targetModule='src/Other.ts',c=>c.targetExport='Other',c=>c.targetMember.signature='unknown',c=>c.targetMember.kind='method',c=>c.targetMember.scope='static',c=>c.sourceMember.minArgs=9,c=>c.sourceMember.signature=c.sourceMember.signature.replace(/String|flash.text.StyleSheet/,'Number')]){
   const changed=structuredClone(candidate);mutate(changed);if(JSON.stringify(changed)===JSON.stringify(candidate))continue;
   const actual=select(changed);assert.equal(actual.mappings.length,0,JSON.stringify(changed));assert.equal(actual.held.length,1);
  }
 }
});
