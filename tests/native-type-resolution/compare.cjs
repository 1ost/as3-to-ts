const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
assert(process.argv[2],'Pass independently compiled baseline lib');const baseline=path.resolve(process.argv[2]),compiler=path.resolve(__dirname,'../..');
const cache=path.join(compiler,'.cache/native-type-resolution');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'run-')),comparisons=[];
for(const suite of ['native-generated-static-getter-receiver','native-generated-public-compound']){
 const results=[];
 for(const [version,lib] of [['baseline',baseline],['current',path.join(compiler,'lib')]]){
  const file=path.join(out,suite+'-'+version+'.json'),started=Date.now();
  const log=execFileSync(process.execPath,['-r',path.join(__dirname,'capture.cjs'),path.join(compiler,'tests',suite,'run.cjs')],{cwd:compiler,env:{...process.env,TYPE_RESOLUTION_LIB:lib,TYPE_RESOLUTION_CAPTURE:file},encoding:'utf8',maxBuffer:8*1024*1024});
  fs.writeFileSync(path.join(out,suite+'-'+version+'.log'),log);const capture=JSON.parse(fs.readFileSync(file));assert.equal(capture.code,0);assert(capture.emissions.length>0);results.push({...capture,elapsedMs:Date.now()-started});
 }
 assert.deepEqual(results[1].emissions,results[0].emissions,suite+' output/rejection mismatch');assert(results[1].resolutions<results[0].resolutions,suite+' should resolve fewer names');
 comparisons.push({suite,baseline:results[0],current:results[1]});console.log(JSON.stringify({suite,emissions:results[0].emissions.length,baselineResolutions:results[0].resolutions,currentResolutions:results[1].resolutions}));
}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({baseline,comparisons},null,2)+'\n');console.log(JSON.stringify({out,status:'passed'}));
