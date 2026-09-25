const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {mkdtempSync, writeFileSync, readFileSync, rmSync, realpathSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join, resolve} = require('node:path');
const {createHash} = require('node:crypto');
const test = require('node:test');
const ROOT = resolve(__dirname, '../..');
const hash = value => createHash('sha256').update(value).digest('hex');
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
    : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(k => JSON.stringify(k)+':'+canonical(value[k])).join(',') + '}' : JSON.stringify(value);

test('default-package base declarations resolve only through authenticated dependency edges', t => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'as3-default-members-')));
    t.after(() => rmSync(dir, {recursive:true, force:true}));
    const entries = ['Base','Derived'].map((qname, i) => {
        const text = `package { public class ${qname}${i ? ' extends Base' : ''} { public function ${qname}() { ${i ? 'super();' : ''} } } }\n`;
        writeFileSync(join(dir,qname+'.as'), text);
        return {qname,module:'application',nodeId:hash(qname).slice(0,16),typeKind:'class',importable:true,
            sourcePath:qname+'.as',sourceContentSha256:hash(text),prerequisites:i ? [hash('Base').slice(0,16)] : []};
    });
    const census=canonical({schema:'swf-capability-census@1',as3SourceCapabilities:{apis:[],memberUses:[]}})+'\n';
    writeFileSync(join(dir,'census.json'),census);
    function run(name) {
        writeFileSync(join(dir,'types.json'),canonical({schema:'as3-application-local-type-map@1',entryCount:2,entries})+'\n');
        const result=spawnSync(process.execPath,[join(ROOT,'tools/generate-local-member-map.cjs'),join(dir,'types.json'),join(dir,name),dir,
            join(ROOT,'lib/declaration-worker.js'),join(dir,'census.json'),hash(census)],{encoding:'utf8',timeout:30000});
        assert.equal(result.status,0,result.stderr);
        return JSON.parse(readFileSync(join(dir,name),'utf8'));
    }
    const valid=run('valid.json');
    assert.equal(valid.completeCount,2);
    assert.deepEqual(valid.entries.find(r=>r.qname==='Derived').declaration.baseQNames,['Base']);
    entries[1].prerequisites=[];
    const missing=run('missing-edge.json');
    assert.equal(missing.entries.find(r=>r.qname==='Derived').holdCode,'LOCAL_MEMBER_TYPE_RESOLUTION');
});
