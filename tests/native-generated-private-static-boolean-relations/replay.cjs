// Diagnostic only: the temporary Capabilities mapping grants no provider authority.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),z=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const old=path.join(root,'tests/native-generated-urlrequest-type-tests/original-replay/report.json.gz'),bytes=fs.readFileSync(old),replay=JSON.parse(z.gunzipSync(bytes));
assert.equal(sha(bytes),require('../native-generated-urlrequest-type-tests/original-replay/pin.json').sha256);
const diagnostic=path.join(root,'tests/native-capabilities-readiness-audit/run.cjs');
const inputs=[old,diagnostic,path.join(root,'src/emit/native-generated-lexical.ts'),path.join(root,'lib/emit/native-generated-lexical.js')].map(file=>({file,sha256:sha(fs.readFileSync(file))}));
const run=flag=>JSON.parse(cp.execFileSync(process.execPath,[diagnostic,flag],{cwd:root,encoding:'utf8'}));
const baseline=run('--baseline'),unqualifiedProvider=run('--unqualified-provider');
assert.equal(baseline.message,'AS3_CLASS_INITIALIZER_UNSUPPORTED: unresolved class-value identity: Capabilities');
assert.equal(unqualifiedProvider.message,'AS3_NAMESPACE_UNSUPPORTED: open namespace member requires explicit selector: stop');
const sources=Object.entries(replay.input.sources).map(([identity,u])=>{assert.equal(sha(u.source),u.sourceSha256);return {identity,sha256:u.sourceSha256};});
assert.equal(sources.length,1356);assert.equal(replay.input.classScriptSources.length,95);
for(const i of inputs)assert.equal(sha(fs.readFileSync(i.file)),i.sha256);
const report={identity:replay.emission.identity,sourceCount:sources.length,classScriptCount:replay.input.classScriptSources.length,sources,inputs,baseline,unqualifiedProvider,productionProviderPromoted:false};
const out=path.join(root,'.cache/native-generated-private-static-boolean-relations');fs.mkdirSync(out,{recursive:true});
const dir=fs.mkdtempSync(path.join(out,'replay-'));fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({dir,baseline,unqualifiedProvider,sourceCount:sources.length,classScriptCount:95}));
