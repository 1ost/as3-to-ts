const path=require('path'),fs=require('fs'),assert=require('assert/strict'),z=require('zlib'),crypto=require('crypto');
const bytes=fs.readFileSync(path.join(__dirname,'report.json.gz')),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(hash(bytes),JSON.parse(fs.readFileSync(path.join(__dirname,'pin.json'))).sha256);
const engine=path.resolve(__dirname,'../../../LayaAir-op2-display-accessor-review');
const report=require(path.join(engine,'tests/nativeGeneratedDisplayAccessors/verify-runtime.cjs'));
assert.deepEqual(JSON.parse(z.gunzipSync(bytes)),report);
