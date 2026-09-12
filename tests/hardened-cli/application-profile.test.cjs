const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join, resolve} = require('node:path');
const {createHash} = require('node:crypto');
const test = require('node:test');
const ROOT = resolve(__dirname,'../..');
const sdk = process.env.HARDENED_FIXTURE_AIR_SDK, laya = process.env.HARDENED_FIXTURE_LAYA;
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');

test('independent application profile emits executable authority and rejects source/authority drift', {skip:!sdk||!laya}, t => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(),'as3-fixture-profile-')));
    t.after(()=>rmSync(dir,{recursive:true,force:true}));
    const source = join(dir,'source'); mkdirSync(source);
    writeFileSync(join(source,'Probe.as'),'package { public class Probe { private var flag:Boolean; public function Probe() {} public function snapshot():Object { return {value:flag}; } } }\n');
    const defaultAuthority = hash(join(ROOT,'config/authority-lock.json'));
    const profile = join(dir,'profile');
    const generated = spawnSync('python3',[join(ROOT,'tools/create-fixture-profile.py'),'--source',source,'--entry','Probe',
        '--laya',laya,'--air-sdk',sdk,'--output',profile],{encoding:'utf8',timeout:60000});
    assert.equal(generated.status,0,generated.stdout+generated.stderr);
    const invoke = output => spawnSync(process.execPath,[join(ROOT,'bin/as3-frontend'),'transpile',source,output,
        '--source-census',join(profile,'census.json'),'--target-capabilities',join(laya,'docTool/architecture/authored-content-capabilities.json'),
        '--profile-lock',join(profile,'profile-lock.json')],{encoding:'utf8',timeout:30000});
    const output=join(dir,'emitted'), emitted=invoke(output); assert.equal(emitted.status,0,emitted.stderr);
    const entry = require(join(output,'__as3_runtime/ApplicationEntry.generated.js'));
    assert.deepEqual(new entry.AS3_APPLICATION_MODULES[0].Probe().snapshot(),{value:false});
    const runtime = require(join(output,'__as3_runtime/AS3Authority.generated.js'));
    const metadata = {schema:'as3-runtime-type-authority@1',qnames:['Probe'],entries:[{
        kind:'class',qname:'Probe',base:null,interfaces:[],sourceSha256:hash(join(source,'Probe.as')),
        fields:[{name:'flag',policy:'false'}],objectTraits:{dynamic:false,members:[
            {name:'flag',kind:'field',type:'Boolean',visibility:'private',namespaceName:null},
            {name:'snapshot',kind:'method',type:'Function',visibility:'public',namespaceName:null}]}}]};
    assert.equal(runtime.AS3_TYPE_AUTHORITY_SHA256,
        createHash('sha256').update(JSON.stringify(metadata)).digest('hex'),
        'Source field visibility and method traits must participate in the sealed authority digest');
    writeFileSync(join(source,'Probe.as'),readFileSync(join(source,'Probe.as'),'utf8').replace('value:flag','value:true'));
    const sourceDrift = invoke(join(dir,'source-drift')); assert.notEqual(sourceDrift.status,0); assert.match(sourceDrift.stderr,/source|hash|declaration/i);
    writeFileSync(join(profile,'census.json'),'{}\n');
    const authorityDrift = invoke(join(dir,'authority-drift')); assert.notEqual(authorityDrift.status,0); assert.match(authorityDrift.stderr,/profile|pin|census|authority/i);
    assert.equal(hash(join(ROOT,'config/authority-lock.json')),defaultAuthority,'Fixture profile must not rewrite the default trust root');
});
