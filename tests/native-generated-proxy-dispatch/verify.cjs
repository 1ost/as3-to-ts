const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const expected=require(path.join(engine,'tests/nativeFlashOracle/proxy-property-dispatch/verify.cjs'));
const bytes=fs.readFileSync(path.join(__dirname,'runtime.json.gz'));
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),require('./runtime-pin.json').sha256);
const report=JSON.parse(zlib.gunzipSync(bytes));
assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
for(const [q,source]of Object.entries(report.cohorts.parent))assert.equal(source.source,fs.readFileSync(path.join(engine,'tests/nativeFlashOracle/proxy-property-dispatch/source',q.replaceAll('.','/')+'.as'),'utf8'));
for(const result of report.results){assert.deepEqual(result.node.rows,expected);assert.deepEqual(result.node,result.web);assert.deepEqual(result.node.domainChecks,[true,true,true,true]);assert.equal(result.rejectionGuards,8);for(const check of result.typechecks)assert.deepEqual(check.diagnostics,[]);}
console.log(JSON.stringify({status:'passed',observations:38,targets:2,realms:2,rejectionGuards:8,domainChecks:4}));
