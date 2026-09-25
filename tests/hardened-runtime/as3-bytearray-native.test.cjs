'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'as3-bytearray-native-'));
const source=path.join(root,'src/hardened-runtime/AS3ByteArray.ts');
const esbuild=require('esbuild');
async function load(name,replacement){
 await esbuild.build({entryPoints:[source],outfile:path.join(dir,name+'.cjs'),bundle:true,platform:'node',format:'cjs',logLevel:'silent',plugins:replacement?[{name:'test-native-facade',setup(build){build.onLoad({filter:/AS3ByteArrayNative\.ts$/},()=>({contents:replacement,loader:'ts'}));}}]:[]});
 return require(path.join(dir,name+'.cjs'));
}
test.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
test('missing native capability fails without modifying an allocated receiver',async()=>{
 const {AS3ByteArray}=await load('missing');const b=AS3ByteArray.fromArrayBuffer(new Uint8Array([1,2]));b.position=7;
 assert.throws(()=>b.uncompress(),/authenticated shared native target/);assert.deepEqual([...new Uint8Array(b.toArrayBuffer())],[1,2]);assert.equal(b.position,7);
 assert.throws(()=>AS3ByteArray.prototype.uncompress.call(Object.create(AS3ByteArray.prototype)),/allocation identity/);
});
test('native result commits atomically to the same indexed allocation',async()=>{
 const {AS3ByteArray,isAS3ByteArray}=await load('success','export function uncompressNativeByteArray(state){state.bytes[0]=99;return {bytes:new Uint8Array([7,8,9]),position:0,endian:state.endian};}');
 const b=AS3ByteArray.fromArrayBuffer(new Uint8Array([1,2]));const alias=b;b.position=12;b.endian='littleEndian';
 assert.equal(b.uncompress(),undefined);assert.equal(alias,b);assert.equal(isAS3ByteArray(b),true);assert.equal(alias[0],7);assert.equal(b.length,3);assert.equal(b.position,0);assert.equal(b.endian,'littleEndian');
 assert.throws(()=>b.uncompress('zlib'),/no algorithm arguments/);
});
test('target failure and invalid return preserve bytes and metadata',async()=>{
 for(const [name,body] of [['throw','state.bytes[0]=99;throw new Error("native2058");'],['invalid','return {bytes:new Uint8Array([9]),position:-1,endian:state.endian};']]){
  const {AS3ByteArray}=await load(name,'export function uncompressNativeByteArray(state){'+body+'}');
  const b=AS3ByteArray.fromArrayBuffer(new Uint8Array([1,2]));b.position=7;b.endian='littleEndian';assert.throws(()=>b.uncompress());
  assert.deepEqual([...new Uint8Array(b.toArrayBuffer())],[1,2]);assert.equal(b.position,7);assert.equal(b.endian,'littleEndian');
 }
});
