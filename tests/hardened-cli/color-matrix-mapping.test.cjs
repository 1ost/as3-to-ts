'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),test=require('node:test');
const {buildSync}=require('esbuild');
test('ColorMatrixFilter admits only its authenticated Array conversion boundary',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'color-matrix-mapping-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const bundle=path.join(dir,'ledger.cjs');buildSync({entryPoints:[path.resolve(__dirname,'../../src/hardened/ledger.ts')],outfile:bundle,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
 const {selectCapabilityCandidates:select}=require(bundle);
 const base={sourceQName:'flash.filters.ColorMatrixFilter',targetCapabilityId:'api.flash.filters',targetModule:'src/layaAir/flash/filters/ColorMatrixFilter.ts',targetExport:'ColorMatrixFilter',targetKind:'class',targetSignature:'typeof ColorMatrixFilter'};
 const cases=[{...base,sourceRoles:['constructor'],sourceMember:{access:'call',name:'ColorMatrixFilter',minArgs:0,maxArgs:1,signature:'public function ColorMatrixFilter(matrix:Array = null)'},targetMember:{name:'ColorMatrixFilter',kind:'constructor',scope:'static',signature:'new (matrix?: readonly unknown[] | null): ColorMatrixFilter'}},
 ...['read','write'].map(access=>({...base,sourceRoles:['instance-member'],sourceMember:{access,name:'matrix',minArgs:access==='read'?0:1,maxArgs:access==='read'?0:1,signature:access==='read'?'public function get matrix() : Array':'public function set matrix(value:Array) : void'},targetMember:{name:'matrix',kind:'get+set',scope:'instance',signature:'get number[]; set readonly unknown[] | null'}}))];
 function check(mapping){
  const member=mapping.sourceMember;
  const source={as3SourceCapabilities:{apis:[{qname:mapping.sourceQName,roles:['import',...mapping.sourceRoles],classification:'layaair-flash-api-bridge',preserve:{apiName:true,signature:true}}],memberUses:[{qname:mapping.sourceQName,member:member.name,access:member.access,context:mapping.sourceRoles[0],argumentCount:member.minArgs,receiverType:mapping.sourceQName,classification:'layaair-flash-api-bridge',preserveNameAndSignature:true,signatures:[{signature:member.signature,minArgs:member.minArgs,maxArgs:member.maxArgs,declaredBy:mapping.sourceQName,kind:mapping.sourceRoles[0]==='constructor'?'constructor':member.access==='read'?'get':'set',returnType:mapping.sourceRoles[0]==='constructor'?'ColorMatrixFilter':member.access==='read'?'Array':'void',static:false}]}]}};
  const target={schema:'laya-authored-content-capabilities@1',capabilities:[{id:mapping.targetCapabilityId,status:'typescript-obligation',obligations:[{module:mapping.targetModule,export:mapping.targetExport,kind:'class',signature:mapping.targetSignature,constructors:mapping.targetMember.kind==='constructor'?[mapping.targetMember.signature]:[],members:mapping.targetMember.kind==='constructor'?[]:[mapping.targetMember]}]}]};
  return select(JSON.stringify(source),JSON.stringify(target),JSON.stringify({schema:'as3-source-to-laya-capability-map@1',mappings:[mapping]}));
 }
 for(const mapping of cases){assert.deepEqual(check(mapping).mappings,[mapping],JSON.stringify(check(mapping).held));
  for(const change of [m=>m.targetModule='src/layaAir/filters/ColorMatrixFilter.ts',m=>m.sourceMember.signature=m.sourceMember.signature.replace('Array','Object'),m=>m.targetMember.signature=m.targetMember.signature.replace('unknown[]','number[]'),m=>m.targetMember.scope=m.targetMember.scope==='static'?'instance':'static']){
   const forged=structuredClone(mapping);change(forged);assert.equal(check(forged).mappings.length,0);
  }
 }
});
