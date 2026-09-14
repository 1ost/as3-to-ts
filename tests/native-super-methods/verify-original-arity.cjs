const fs=require('fs'),path=require('path'),assert=require('assert'),cp=require('child_process');
const {verify,hash}=require('./evidence.cjs');
const evidence=verify();
assert(process.env.FLEX_SDK,'Set FLEX_SDK to the original Apache Flex 4.16.1 SDK directory');
const flex=path.resolve(process.env.FLEX_SDK);
const expected={
    'lib/mxmlc.jar':'cc07d749e376715e650271a9875289e49d94234902fff5e5fae287c478c8557b',
    'frameworks/libs/player/26.0/playerglobal.swc':'0e450154692d044b1758064825e072476421560c43f6a026b12df4cfda82e295'
};
for(const [relative,sha] of Object.entries(expected))assert.equal(hash(fs.readFileSync(path.join(flex,relative))),sha,relative);
const output=path.resolve(__dirname,'../../.cache/native-super-methods');fs.mkdirSync(output,{recursive:true});
const run=fs.mkdtempSync(path.join(output,'original-arity-')),commands=[];
for(const name of ['Missing','Extra']) {
    const args=['-Xmx384m','-jar',path.join(flex,'lib/mxmlc.jar'),'+flexlib='+path.join(flex,'frameworks'),
        '-target-player=26.0','-swf-version=37','-source-path='+path.join(evidence.directory,'sources'),
        '-output='+path.join(run,name+'.swf'),path.join(evidence.directory,'original-arity',name+'Oracle.as')];
    const result=cp.spawnSync(process.env.JAVA||'java',args,{cwd:run,encoding:'utf8',timeout:60000,
        env:{...process.env,PLAYERGLOBAL_HOME:path.join(flex,'frameworks/libs/player')}});
    commands.push({name,command:[process.env.JAVA||'java',...args],exitCode:result.status,stdout:result.stdout,stderr:result.stderr,error:result.error&&String(result.error)});
    fs.writeFileSync(path.join(run,'commands.json'),JSON.stringify(commands,null,2)+'\n');
    assert.ifError(result.error);assert.equal(result.status,1);
    assert(result.stderr.includes('Incorrect number of arguments.'));
    assert(result.stderr.includes(name==='Missing'?'Expected 1.':'Expected no more than 2.'));
    assert(!fs.existsSync(path.join(run,name+'.swf')));
}
fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({receiptSHA256:evidence.receiptHash,compilerToolHashes:expected,
    sourceInputs:['sources/superprobe/Base.as','sources/superprobe/Journal.as','original-arity/MissingOracle.as','original-arity/ExtraOracle.as'].map(file=>({path:file,sha256:hash(fs.readFileSync(path.join(evidence.directory,file)))})),
    rejected:['missing-direct-super-argument','extra-direct-super-argument']},null,2)+'\n');
console.log('Both original direct-super arity diagnostics reproduced: '+run);
