const assert=require('node:assert/strict'),cp=require('node:child_process');
if(!process.argv.includes('--child')){
 const run=cp.spawnSync(process.execPath,['--max-old-space-size=128',__filename,'--child'],
  {encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:16384});
 assert.equal(run.status,0,run.error?.message||run.stderr);console.log(run.stdout.trim());
}else{
 const ts=require('typescript'),check=require('./assert-diagnostics.cjs');
 const result=ts.transpileModule('const key: unique symbol=Symbol.for("probe");class C {[key]:number=0;}',{reportDiagnostics:true});
 assert(result.diagnostics.length>0);assert.throws(()=>check(ts,result.diagnostics),e=>e.message.includes('diagnostic(s)')&&e.message.length<10000);
 check(ts,[]);console.log('Legacy parser diagnostics fail safely within a 128 MiB heap.');
}
