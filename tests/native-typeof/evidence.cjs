const fs=require('fs'),path=require('path'),assert=require('assert'),cp=require('child_process'),crypto=require('crypto');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const json=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function verify(group) {
    const entry=json(path.join(__dirname,'evidence-index.json')).groups.find(row=>row.group===group);
    assert(entry,group);
    const receiptPath=path.join(__dirname,entry.receipt),directory=path.dirname(receiptPath);
    assert.equal(hash(fs.readFileSync(receiptPath)),entry.sha256,'receipt digest');
    const receipt=json(receiptPath),provenance=json(path.join(directory,'provenance.json'));
    for(const file of receipt.files) {
        const local=path.resolve(directory,file.path);
        assert(local.startsWith(directory+path.sep),'retained path confinement');
        assert.equal(hash(fs.readFileSync(local)),file.sha256,file.path);
        if(file.originalPath) {
            const authority=provenance.files.find(row=>row.path===file.originalPath);
            assert(authority,file.originalPath);assert.equal(authority.sha256,file.sha256,file.path+' original provenance');
        }
    }
    const expected=json(path.join(directory,'flash.json'));
    assert(!expected.failure,'original capture failure');
    assert.equal(expected.rows.length,receipt.rows);
    assert.equal((expected.lifecycle||[]).length,receipt.lifecycleSteps);
    const metadata=json(path.join(directory,'metadata.json'));
    assert.equal(metadata.captureSha256,hash(fs.readFileSync(path.join(directory,'flash.json'))));
    // Rebuild ordered metadata from the authenticated original reflection XML.
    // The compiler's sorted member validation is not a substitute for this step.
    const rebuilt=JSON.parse(cp.execFileSync(process.env.PYTHON||'python',
        [path.join(__dirname,'extract-metadata.py'),directory],{encoding:'utf8',maxBuffer:4*1024*1024}));
    assert.deepStrictEqual(metadata,rebuilt,'ordered metadata differs from original Flash XML');
    const sources=Object.fromEntries(Object.entries(metadata.classes).map(([name,record])=>{
        const source=fs.readFileSync(path.join(directory,'sources',name.replace(/\./g,'/')+'.as'),'utf8');
        assert.equal(hash(source),record.sourceSha256,name+' source');return [name,source];
    }));
    return {directory,expected,metadata,sources,receiptSHA256:entry.sha256};
}
function authenticateMetadata(evidence,candidate) {
    assert.deepStrictEqual(candidate,evidence.metadata,'trusted metadata input differs from exact authenticated capture');
    return {module:'./AS3MethodBinding',classes:candidate.classes};
}
module.exports={verify,authenticateMetadata,hash};
