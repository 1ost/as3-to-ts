const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{gzipSync,gunzipSync}=require('node:zlib'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2-boolean-string-review');
const hash=b=>createHash('sha256').update(b).digest('hex'),normalized=file=>hash(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'));
const read=file=>JSON.parse(fs.readFileSync(file)),suites={
 'native-generated-class-constructors':[88,5,9],
 'native-generated-vector-constructors':[101,6,15],
 'native-generated-event-reference-constructors':[65,8,12]
};
const validate=({comparison,protocols,scaling})=>{
 assert.deepEqual(comparison.comparisons.map(r=>r.suite),Object.keys(suites));let outputs=0,rejections=0;
 for(const r of comparison.comparisons){
  assert.equal(r.baseline.code,0);assert.equal(r.current.code,0);assert.deepEqual(r.current.emissions,r.baseline.emissions);
  assert(r.current.comparisons<=r.baseline.comparisons);
  if(r.baseline.comparisons===0)assert.equal(r.current.indexRows,0);
  outputs+=r.current.emissions.filter(e=>e.sha256).length;rejections+=r.current.emissions.filter(e=>e.error).length;
  const report=protocols[r.suite],[rows,compilerGuards,runtimeGuards]=suites[r.suite];
  const oracle=path.join(engine,'tests/nativeFlashOracle',r.suite.replace('native-',''));
  const expected=require(path.join(oracle,'verify.cjs'));assert.equal(expected.length,rows);
  for(const [q,s] of Object.entries(report.sources)){const source=fs.readFileSync(path.join(oracle,'source',q.replaceAll('.','/')+'.as'),'utf8');assert.equal(s.source,source);assert.equal(s.sourceSha256,hash(source));}
  for(const [file,key] of [['run.cjs','runnerSha256'],['observer.ts','observerSha256']])assert.equal(normalized(path.join(root,'tests',r.suite,file)),report[key]);
  for(const i of report.compilerGraph)assert.equal(normalized(path.resolve(root,i.file)),i.sha256,i.file);
  assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
  for(const result of report.results){
   assert.deepEqual(result.web.rows,expected);assert.equal(result.guards,compilerGuards);assert.equal(result.web.guards,runtimeGuards);
   assert.deepEqual(result.errors,[]);assert.deepEqual(result.diagnostics,[]);
   assert(r.current.emissions.some(e=>e.sha256===hash(JSON.stringify(result.artifact))));
   for(const i of result.providerGraph)assert.equal(normalized(path.resolve(root,i.file)),i.sha256,i.file);
  }
 }
 const {baselineResult:b,currentResult:c}=scaling;assert.equal(b.code,0);assert.equal(c.code,0);
 assert.deepEqual(c.emissions,b.emissions);assert.deepEqual(c.report,b.report);assert.equal(c.emissions.length,2);
 assert(c.emissions.every(e=>e.sha256));assert(c.comparisons+c.indexRows<b.comparisons);
 assert.deepEqual(c.report.results.map(r=>r.target),['ES5','ES2015']);assert(c.report.results.every(r=>r.sourceClasses===66));
 return {identicalArtifacts:outputs+2,identicalRejections:rejections,airRows:254,targets:2,runtime:'Chromium with real Laya',typeErrors:0,
  scaling:{baselineComparisons:b.comparisons,currentComparisons:c.comparisons,indexRows:c.indexRows}};
};
const pinFile=path.join(__dirname,'validation-pin.json'),archive=path.join(__dirname,'validation.json.gz');
if(process.argv[2]==='--retain'){
 assert.equal(process.argv.length,5,'Pass comparison JSON and scaling report');
 const comparison=read(process.argv[3]),scaling=read(process.argv[4]),protocols={};
 for(const row of comparison.comparisons)protocols[row.suite]=read(path.join(row.current.reportDirectory,'report.json'));
 const data={comparison,protocols,scaling};validate(data);
 const bytes=gzipSync(Buffer.from(JSON.stringify(data)),{level:9});fs.writeFileSync(archive,bytes);
 const helpers=['capture.cjs','compare.cjs','scaling.cjs','compare-scaling.cjs','verify.cjs'];
 fs.writeFileSync(pinFile,JSON.stringify({baseCommit:'45bfddd87742c7150b02a600e8735a7654d1f1af',engineCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim(),sha256:hash(bytes),
  baselineCallableSha256:hash(fs.readFileSync(path.join(comparison.baseline,'emit/native-callable-classes.js'))),
  helpers:Object.fromEntries(helpers.map(f=>[f,normalized(path.join(__dirname,f))])),eventOrderFailureSha256:hash(fs.readFileSync(path.join(__dirname,'event-order-failure.json.gz')))},null,2)+'\n');
}
const pin=read(pinFile),bytes=fs.readFileSync(archive);assert.equal(hash(bytes),pin.sha256);
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim(),pin.engineCommit);
for(const [f,sha] of Object.entries(pin.helpers))assert.equal(normalized(path.join(__dirname,f)),sha,f);
assert.equal(hash(fs.readFileSync(path.join(__dirname,'event-order-failure.json.gz'))),pin.eventOrderFailureSha256);
const data=JSON.parse(gunzipSync(bytes));assert.equal(hash(fs.readFileSync(path.join(data.comparison.baseline,'emit/native-callable-classes.js'))),pin.baselineCallableSha256);
console.log(JSON.stringify(validate(data)));
