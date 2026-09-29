const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const raw=require(path.join(engine,'tests/nativeFlashOracle/generated-accessibility/verify.cjs'));
const normalize=row=>row.id.startsWith('metadata-')?{...row,value:row.value.replace(/>\s+</g,'><')}:row;
const expected=raw.map(normalize);
const bytes=fs.readFileSync(path.join(__dirname,'runtime.json.gz'));
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),require('./runtime-pin.json').sha256);
const report=JSON.parse(zlib.gunzipSync(bytes));
assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
for(const [q,source]of Object.entries(report.cohorts.parent))assert.equal(source.source,fs.readFileSync(path.join(engine,'tests/nativeFlashOracle/generated-accessibility/source',q.replaceAll('.','/')+'.as'),'utf8'));
for(const result of report.results){assert.deepEqual(result.node.rows.map(normalize),expected);assert.deepEqual(result.node,result.web);assert.deepEqual(result.node.domainChecks,[true,true,true,true]);assert.equal(result.rejectionGuards,7);assert.equal(result.node.runtimeGuards,16);for(const check of result.typechecks)assert.deepEqual(check.diagnostics,[]);}
console.log(JSON.stringify({status:'passed',observations:12,targets:2,realms:2,rejectionGuards:7,runtimeGuards:16,domainChecks:4}));
