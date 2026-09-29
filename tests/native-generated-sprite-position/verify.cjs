const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=__dirname,compiler=path.resolve(root,'../..'),engine=path.resolve(compiler,'../LayaAir-op2');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),pin=require('./evidence-pin.json');
const expected=require(path.join(engine,'tests/nativeFlashOracle/generated-sprite-position-overrides/verify.cjs'));
assert.equal(expected.length,21);assert.equal(pin.fullGame,false);
for(const [file,sha]of Object.entries(pin.runner))assert.equal(hash(fs.readFileSync(path.join(root,file))),sha,file);
for(const [key,sha]of Object.entries(pin.implementation)){
 const [repository,file]=key.split(':');assert.equal(hash(fs.readFileSync(path.join(repository==='engine'?engine:compiler,file))),sha,key);
}
for(const target of ['ES5','ES2015']){
 const file=target+'.json.gz',bytes=fs.readFileSync(path.join(root,'evidence',file));assert.equal(hash(bytes),pin.files[file]);
 const report=JSON.parse(zlib.gunzipSync(bytes));assert.equal(report.target,target);assert.equal(report.status,'passed');
 assert.deepEqual(report.observation.rows,expected);assert.equal(report.observation.guards.length,5);assert.equal(new Set(report.observation.guards).size,5);
 assert.deepEqual(report.mutations,['missing-contract','missing-override','wrong-type','wrong-half','wrong-base','accessor-getter','final-parent']);
 assert.deepEqual(report.review.diagnostics,[]);assert.deepEqual(report.review.unresolved,[]);assert.equal(report.review.factoryHold,undefined);assert.equal(report.review.compilerGuards.length,4);
 for(const [key,sha]of Object.entries(pin.implementation)){
  const relative=key.slice(key.indexOf(':')+1),input=[...report.inputs,...report.review.compilerInputs].find(row=>row.file.replaceAll('\\','/').endsWith('/'+relative));
  assert.ok(input,key);assert.equal(input.sha256,sha,key);
 }
}
console.log('Sprite position overrides: 21 Flash rows, 5 receiver checks, 4 compiler guards and 7 factory mutations pass in ES5 and ES2015.');
