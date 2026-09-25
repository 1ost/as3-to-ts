'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
test('TextFormat final mapping keeps exact source Object and qualified read/write limits',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'format-property-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const bundle=path.join(dir,'ledger.cjs');require('esbuild').buildSync({entryPoints:[path.resolve(__dirname,'../../src/hardened/ledger.ts')],outfile:bundle,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
 const {selectCapabilityCandidates:select}=require(bundle);
 function run(name,access,type,sourceType,alter=()=>{}){
  const signature=access==='read'?`public function get ${name}() : ${sourceType}`:`public function set ${name}(value:${sourceType}) : void`;
  const mapping={sourceQName:'flash.text.TextFormat',sourceRoles:['instance-member'],sourceMember:{access,name,minArgs:access==='read'?0:1,maxArgs:access==='read'?0:1,signature},targetCapabilityId:'api.flash.text',targetExport:'TextFormat',targetKind:'class',targetModule:'src/layaAir/flash/text/TextFormat.ts',targetSignature:'typeof TextFormat',targetMember:{kind:'get+set',name,scope:'instance',signature:type}};alter(mapping);
  const source={as3SourceCapabilities:{apis:[{qname:mapping.sourceQName,classification:'layaair-flash-api-bridge',roles:['instance-member'],preserve:{apiName:true,signature:true}}],memberUses:[{qname:mapping.sourceQName,member:name,access,classification:'layaair-flash-api-bridge',context:'instance-member',receiverType:mapping.sourceQName,argumentCount:null,preserveNameAndSignature:true,signatures:[{signature,minArgs:mapping.sourceMember.minArgs,maxArgs:mapping.sourceMember.maxArgs,declaredBy:mapping.sourceQName,kind:access==='read'?'get':'set',static:false,returnType:access==='read'?sourceType:'void'}]}]}};
  const target={schema:'laya-authored-content-capabilities@1',capabilities:[{id:'api.flash.text',status:'typescript-obligation',obligations:[{module:mapping.targetModule,export:mapping.targetExport,kind:'class',signature:mapping.targetSignature,constructors:['new (font?: string | null, size?: number | null, color?: number | null, bold?: boolean | null, italic?: boolean | null, underline?: boolean | null, url?: string | null, target?: string | null, align?: string | null, leftMargin?: number | null, rightMargin?: number | null, indent?: number | null, leading?: number | null): TextFormat'],members:[mapping.targetMember]}]}]};
  return select(JSON.stringify(source),JSON.stringify(target),JSON.stringify({schema:'as3-source-to-laya-capability-map@1',mappings:[mapping]}));
 }
 for(const [name,type,source] of [['font','string','String'],['size','number','Object'],['color','number','Object'],['bold','boolean','Object'],['tabStops','number[]','Array']]){
  for(const target of [type,type+' | null'])assert.equal(run(name,'read',target,source).mappings.length,1,JSON.stringify(run(name,'read',target,source)));
  const write=run(name,'write',type,source);assert.equal(write.mappings.length,['font','size'].includes(name)?1:0,JSON.stringify(write));
 }
 for(const args of [['size','read','boolean','Object'],['size','read','number','Number'],['font','read','string','Object'],['unknownField','read','string','String']])assert.equal(run(...args).mappings.length,0,JSON.stringify(args));
 assert.equal(run('font','read','string','String',m=>m.targetModule='other/TextFormat.ts').mappings.length,0);
 assert.equal(run('font','read','string','String',m=>m.targetMember.name='url').mappings.length,0);
});
