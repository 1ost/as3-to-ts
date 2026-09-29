const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),c=require('node:crypto'),assert=require('node:assert/strict');
const hash=b=>c.createHash('sha256').update(b).digest('hex'),bytes=fs.readFileSync(path.join(__dirname,'runtime.json.gz'));
assert.equal(hash(bytes),require('./runtime-pin.json').sha256);const report=JSON.parse(z.gunzipSync(bytes));
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2'),oracle=path.join(engine,'tests/nativeFlashOracle/generated-native-interface-constructors');
const expected=require(path.join(oracle,'verify.cjs'));
assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
for(const result of report.results){assert.deepEqual(result.node.rows,expected);assert.deepEqual(result.web,result.node);assert.equal(result.node.guards,6);assert.equal(result.guards,6);assert.deepEqual(result.diagnostics,[]);assert.deepEqual(result.errors,[]);}
for(const [q,source]of Object.entries(report.sources)){const text=fs.readFileSync(path.join(oracle,'source',q.replaceAll('.','/')+'.as'),'utf8');assert.equal(source.source,text);assert.equal(source.sourceSha256,hash(text));}
for(const [file,key]of [['run.cjs','runnerSha256'],['observer.ts','observerSha256']])assert.equal(hash(fs.readFileSync(path.join(__dirname,file),'utf8').replace(/\r\n/g,'\n')),report[key]);
const entry=report.compilerGraph.find(p=>p.file==='src/emit/native-callable-classes.ts');assert.ok(entry);assert.equal(hash(fs.readFileSync(path.resolve(__dirname,'../../src/emit/native-callable-classes.ts'),'utf8').replace(/\r\n/g,'\n')),entry.sha256);
console.log(JSON.stringify({status:'passed',rows:32,compilerGuards:6,runtimeGuards:6,targets:2,runtimes:['Node','Chromium']}));
