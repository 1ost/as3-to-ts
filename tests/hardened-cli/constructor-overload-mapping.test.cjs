'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {buildSync}=require('esbuild');
test('final constructor selection authenticates one exact overload without weakening bitmap rules',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'constructor-overloads-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const bundle=path.join(dir,'ledger.cjs');buildSync({entryPoints:[path.resolve(__dirname,'../../src/hardened/ledger.ts')],outfile:bundle,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
 const {selectCapabilityCandidates:select}=require(bundle);
 const signature='new (): Loader',host='new (nativeContentHost?: NativeLoaderContentHost | null, nativeImageHost?: NativeLoaderImageHost): Loader';
 const mapping={sourceQName:'flash.display.Loader',sourceRoles:['constructor'],sourceMember:{access:'call',name:'Loader',minArgs:0,maxArgs:0,signature:'public function Loader()'},targetCapabilityId:'api.flash.display',targetExport:'Loader',targetKind:'class',targetModule:'src/layaAir/flash/display/Loader.ts',targetSignature:'typeof Loader',targetMember:{kind:'constructor',name:'Loader',scope:'static',signature}};
 const source={as3SourceCapabilities:{apis:[{qname:mapping.sourceQName,classification:'layaair-flash-api-bridge',roles:['constructor'],preserve:{apiName:true,signature:true}}],memberUses:[{qname:mapping.sourceQName,member:'Loader',access:'call',classification:'layaair-flash-api-bridge',context:'constructor',preserveNameAndSignature:true,signatures:[{signature:mapping.sourceMember.signature,minArgs:0,maxArgs:0}]}]}};
 function run(constructors,alter=()=>{},members=[]){
  const candidate=structuredClone(mapping),census=structuredClone(source);alter(candidate,census);
  const target={schema:'laya-authored-content-capabilities@1',capabilities:[{id:'api.flash.display',status:'typescript-obligation',obligations:[{module:candidate.targetModule,export:candidate.targetExport,kind:'class',signature:candidate.targetSignature,constructors,members}]}]};
  return select(JSON.stringify(census),JSON.stringify(target),JSON.stringify({schema:'as3-source-to-laya-capability-map@1',mappings:[candidate]}));
 }
 for(const constructors of [[signature],[signature,host],[host,signature]]){const result=run(constructors);assert.deepEqual(result.mappings,[mapping],JSON.stringify(result.held));assert.equal(result.held.length,0);}
 for(const constructors of [[],[host],[signature,signature],[signature,host,signature],[signature,42]]){const result=run(constructors);assert.equal(result.mappings.length,0);assert.equal(result.held[0]?.code,'HARDENED_TARGET_MEMBER');}
 const forgery=run([signature,host],m=>m.targetMember.signature='new (value: number): Loader');assert.equal(forgery.mappings.length,0);assert.equal(forgery.held[0]?.code,'HARDENED_TARGET_CONSTRUCTOR_ARITY');
 const sameArityForgery=run([signature,host],m=>m.targetMember.signature='new (): Different');assert.equal(sameArityForgery.mappings.length,0);assert.equal(sameArityForgery.held[0]?.code,'HARDENED_TARGET_MEMBER');
 // An invented constructor in ordinary members must not bypass the constructor ledger.
 assert.equal(run([signature,signature],()=>{},[mapping.targetMember]).mappings.length,0);
 const changedSource=run([signature,host],m=>m.sourceMember.maxArgs=1);assert.equal(changedSource.mappings.length,0);
 // Even matching an overload is insufficient when source/target argument contracts differ.
 const changedTarget=run(['new (value: number): Loader',host],m=>m.targetMember.signature='new (value: number): Loader');assert.equal(changedTarget.mappings.length,0);
 const bitmapSignature='new (bitmapData?: BitmapData | null, pixelSnapping?: string, smoothing?: boolean): Bitmap';
 const bitmapSource='public function Bitmap(bitmapData:flash.display.BitmapData = null, pixelSnapping:String = "auto", smoothing:Boolean = false)';
 const asBitmap=(m,s)=>{
  m.sourceQName='flash.display.Bitmap';m.sourceMember.name='Bitmap';m.sourceMember.signature=bitmapSource;m.sourceMember.maxArgs=3;m.targetExport='Bitmap';m.targetModule='src/layaAir/flash/display/Bitmap.ts';m.targetSignature='typeof Bitmap';m.targetMember.name='Bitmap';m.targetMember.signature=bitmapSignature;
  s.as3SourceCapabilities.apis[0].qname=m.sourceQName;const use=s.as3SourceCapabilities.memberUses[0];use.qname=m.sourceQName;use.member='Bitmap';use.receiverType=m.sourceQName;use.argumentCount=0;
  use.signatures=[{signature:bitmapSource,minArgs:0,maxArgs:3,declaredBy:m.sourceQName,kind:'constructor',static:false,returnType:'Bitmap'}];
 };
 const validBitmap=run([bitmapSignature],asBitmap);assert.equal(validBitmap.mappings.length,1,JSON.stringify(validBitmap.held));
 const bitmap=run([bitmapSignature,'new (): Bitmap'],asBitmap);assert.equal(bitmap.mappings.length,0);assert.equal(bitmap.held[0]?.code,'HARDENED_TARGET_MEMBER',JSON.stringify(bitmap.held));
});
