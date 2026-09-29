const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=__dirname,compiler=path.resolve(root,'../..'),engine=path.resolve(compiler,'../LayaAir-op2');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),pin=require('./evidence-pin.json');
const expected=require(path.join(engine,'tests/nativeFlashOracle/generated-parent-removal/verify.cjs'));
assert.equal(expected.length,12);assert.equal(pin.fullGame,false);
for(const [file,sha]of Object.entries(pin.runner))assert.equal(hash(fs.readFileSync(path.join(root,file))),sha,file);
assert.equal(hash(fs.readFileSync(path.join(compiler,'src/emit/emitter.ts'))),pin.emitter);
for(const target of ['ES5','ES2015']){
 const file=target+'.json.gz',bytes=fs.readFileSync(path.join(root,'evidence',file));assert.equal(hash(bytes),pin.files[file]);
 const report=JSON.parse(zlib.gunzipSync(bytes));assert.equal(report.target,target);assert.equal(report.status,'passed');
 assert.deepEqual(report.observation.rows,expected);
 assert.deepEqual(report.review.diagnostics,[]);assert.deepEqual(report.review.unresolved,[]);assert.equal(report.review.factoryHold,undefined);
 assert.deepEqual(report.review.compilerGuards,['missing reference plan','unrelated reference plan']);
 assert.equal(report.review.compilerInputs.find(row=>row.file.replaceAll('\\','/').endsWith('/src/emit/emitter.ts')).sha256,pin.emitter);
}
console.log('Generated parent removal: 12 original Flash rows and two admission guards pass in ES5 and ES2015.');
