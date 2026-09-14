const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const directory=path.join(__dirname,'evidence');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const read=name=>JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'));
exports.verify=function() {
    const receiptHash=fs.readFileSync(path.join(__dirname,'receipt.sha256'),'utf8').trim();
    assert.equal(hash(fs.readFileSync(path.join(directory,'receipt.json'))),receiptHash);
    const receipt=read('receipt.json'),provenance=read('provenance.json');
    for(const file of receipt.files) {
        const absolute=path.resolve(directory,file.path);
        assert(absolute.startsWith(directory+path.sep));
        assert.equal(hash(fs.readFileSync(absolute)),file.sha256,file.path);
        if(file.originalPath) {
            const original=provenance.files.find(item=>item.path===file.originalPath);
            assert(original,file.originalPath);assert.equal(original.sha256,file.sha256);
        }
    }
    const arity=read('original-arity/commands.json');
    assert.deepStrictEqual(arity.map(item=>item.name),['Missing','Extra']);
    for(const command of arity) {
        assert.notEqual(command.exitCode,0);
        assert(command.stderr.includes('Incorrect number of arguments'));
    }
    const authority=read('candidate-receipt.json').files.find(item=>item.path.replace(/\\/g,'/')==='original-arity/commands.json');
    assert(authority);
    assert.equal(hash(fs.readFileSync(path.join(directory,'original-arity/commands.json'))),authority.sha256);
    const expected=read('flash.json');assert.equal(expected.length,25);
    assert.equal(receipt.originalRows,25);assert.equal(receipt.directRows,23);
    assert.deepStrictEqual(receipt.held.map(item=>({index:item.index,id:item.id,expected:item.expected})),[
        {index:23,id:'detached-stable-receiver-bound',expected:'detached:true:middle-zero'},
        {index:24,id:'detached-closure-extra-argument',expected:'detached-arity:1063'}]);
    for(const item of receipt.held)assert.equal(expected[item.index],item.expected);
    const heldIndices=new Set(receipt.held.map(item=>item.index));
    const direct=expected.filter((_,index)=>!heldIndices.has(index));assert.equal(direct.length,23);
    return {receiptHash,receipt,expected,direct,directory};
};
exports.hash=hash;
exports.verifyReview=function() {
    const directory=path.join(__dirname,'review-evidence');
    const receiptHash=fs.readFileSync(path.join(__dirname,'review-receipt.sha256'),'utf8').trim();
    assert.equal(hash(fs.readFileSync(path.join(directory,'receipt.json'))),receiptHash);
    const receipt=JSON.parse(fs.readFileSync(path.join(directory,'receipt.json'),'utf8'));
    const provenance=JSON.parse(fs.readFileSync(path.join(directory,'provenance.json'),'utf8'));
    for(const file of receipt.files) {
        const absolute=path.resolve(directory,file.path);assert(absolute.startsWith(directory+path.sep));
        assert.equal(hash(fs.readFileSync(absolute)),file.sha256,file.path);
        if(file.originalPath) {
            const authority=provenance.files.find(item=>item.path===file.originalPath);
            assert(authority,file.originalPath);assert.equal(authority.sha256,file.sha256);
        }
    }
    const expected=JSON.parse(fs.readFileSync(path.join(directory,'flash.json'),'utf8'));
    assert.equal(expected.length,30);assert.equal(receipt.originalRows,30);assert.equal(receipt.directRows,30);
    assert.deepStrictEqual(receipt.held,[]);
    return {directory,receiptHash,receipt,expected,direct:expected};
};
