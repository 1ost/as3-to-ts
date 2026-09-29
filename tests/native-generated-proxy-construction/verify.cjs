const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const original=require(path.join(engine,'tests/nativeFlashOracle/generated-proxy-construction/verify.cjs'));
const reflection=require(path.join(engine,'tests/nativeProxyConstruction/generate.cjs'));
const bytes=fs.readFileSync(path.join(__dirname,'runtime.json.gz'));
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),require('./runtime-pin.json').sha256);
const report=JSON.parse(zlib.gunzipSync(bytes));
assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
for(const result of report.results){
 assert.deepEqual(result.node.rows,original.filter(row=>!row.id.startsWith('metadata-')));
 assert.deepEqual(result.node.reflection,reflection);assert.deepEqual(result.node,result.web);
 assert.deepEqual(result.node.domainChecks,[true,true,true,true]);assert.equal(result.node.guards.length,8);
 assert.equal(result.rejectionGuards,5);for(const check of result.typechecks)assert.deepEqual(check.diagnostics,[]);
}
console.log(JSON.stringify({status:'passed',targets:2,realms:2,observations:10,reflectionDocuments:2,guards:8,domainChecks:4,rejectionGuards:5}));
