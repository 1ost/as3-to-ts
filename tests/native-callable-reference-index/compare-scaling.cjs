const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
assert(process.argv[2],'Pass baseline lib');const baseline=path.resolve(process.argv[2]),root=path.resolve(__dirname,'../..');
const cache=path.join(root,'.cache/native-callable-reference-index');fs.mkdirSync(cache,{recursive:true});
const out=fs.mkdtempSync(path.join(cache,'scaling-')),results=[];
for(const [version,lib] of [['baseline',baseline],['current',path.join(root,'lib')]]){
 const file=path.join(out,version+'.json');
 const log=execFileSync(process.execPath,['-r',path.join(__dirname,'capture.cjs'),path.join(__dirname,'scaling.cjs')],{cwd:root,env:{...process.env,REFERENCE_INDEX_LIB:lib,REFERENCE_INDEX_CAPTURE:file},encoding:'utf8'});
 fs.writeFileSync(path.join(out,version+'.log'),log);const capture=JSON.parse(fs.readFileSync(file));assert.equal(capture.code,0);
 const report=JSON.parse(fs.readFileSync(path.join(JSON.parse(log.trim()).out,'report.json')));
 assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);assert(report.results.every(r=>r.sourceClasses===66));
 assert.equal(capture.emissions.length,2);assert(capture.emissions.every(e=>e.sha256));results.push({...capture,report});
}
assert.deepEqual(results[1].emissions,results[0].emissions);assert.deepEqual(results[1].report,results[0].report);
assert(results[1].comparisons+results[1].indexRows<results[0].comparisons,'Index building plus searches must beat the baseline scans');
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({baseline,baselineResult:results[0],currentResult:results[1]},null,2)+'\n');
console.log(JSON.stringify({out,baselineComparisons:results[0].comparisons,currentComparisons:results[1].comparisons,indexRows:results[1].indexRows,status:'passed'}));
