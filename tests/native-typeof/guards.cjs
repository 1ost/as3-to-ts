const fs=require('fs'),path=require('path'),assert=require('assert');
const {hash}=require('./evidence.cjs');
exports.run=function(compiler,evidence) {
    const parse=require(path.join(compiler,'lib/parse')),emit=require(path.join(compiler,'lib/emit')),passed=[];
    const original=evidence.sources['typeprobe.Subject'],clone=value=>JSON.parse(JSON.stringify(value));
    function compile(source,metadata) {
        return emit(parse('Subject.as',source),source,{customVisitors:[],definitionsByNamespace:{},nativeClassInitialization:{classes:{'typeprobe.Subject':'lazy'}},
            nativeCallableMethodBindingModule:'./AS3MethodBinding',nativeCallableCoercionModule:'./AS3MethodBinding',nativeCallableClasses:{'typeprobe.Subject':source},nativeCallableMetadata:metadata});
    }
    for(const operand of ['absentName','(absentName)','absentName.value','absentName()']) {
        const source=original.replace('return typeof Subject;','return typeof '+operand+';'),metadata=clone(evidence.metadata);
        assert.notEqual(source,original);metadata.classes['typeprobe.Subject'].sourceSha256=hash(source);
        assert.throws(()=>compile(source,{module:'./AS3MethodBinding',classes:metadata.classes}),/unresolved typeof operand: absentName/);passed.push('unresolved '+operand);
    }
    const legacy=compile(original,undefined);
    assert(legacy.includes('typeof Subject'));assert(!legacy.includes('.as3TypeOf('));
    passed.push('legacy non-metadata output does not acquire provider lowering');
    for(const [name,change] of [
        ['readonly access',record=>record.metadata.statics.accessors.find(x=>x.name==='chosen').access='readwrite'],
        ['getter omitted',record=>record.metadata.statics.accessors=record.metadata.statics.accessors.filter(x=>x.name!=='chosen')],
        ['getter trait type',record=>record.staticTraits.find(x=>x.name==='chosen').type='String'],
        ['getter metadata namespace',record=>record.metadata.statics.accessors.find(x=>x.name==='chosen').uri='fake'],
        ['invented getter',record=>record.metadata.statics.accessors.push({name:'fake',declaredBy:record.metadata.name,access:'readonly'})]]) {
        const metadata=clone(evidence.metadata);change(metadata.classes['typeprobe.Subject']);
        assert.throws(()=>compile(original,{module:'./AS3MethodBinding',classes:metadata.classes}),/AS3_CLASS_METADATA_UNSUPPORTED/);passed.push(name);
    }
    const setter=original.replace('  public function Subject(){}','  public function Subject(){} public function set read(input:*):void {}');
    const setterMetadata=clone(evidence.metadata);setterMetadata.classes['typeprobe.Subject'].sourceSha256=hash(setter);
    assert.throws(()=>compile(setter,{module:'./AS3MethodBinding',classes:setterMetadata.classes}),/source setter\/custom trait validation pending/);passed.push('setter held');
    const typed=original.replace('function get read():*','function get read():String');
    const typedMetadata=clone(evidence.metadata);typedMetadata.classes['typeprobe.Subject'].sourceSha256=hash(typed);
    assert.throws(()=>compile(typed,{module:'./AS3MethodBinding',classes:typedMetadata.classes}),/typed getter return coercion integration pending/);passed.push('typed getter return held');
    const directory=path.join(__dirname,'original/unresolved'),receiptPath=path.join(directory,'receipt.json');
    assert.equal(hash(fs.readFileSync(receiptPath)),fs.readFileSync(path.join(__dirname,'unresolved-receipt.sha256'),'utf8').trim());
    const receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8'));
    for(const file of receipt.files) {const retained=path.resolve(directory,file.path);assert(retained.startsWith(directory+path.sep));assert.equal(hash(fs.readFileSync(retained)),file.sha256);}
    const commands=JSON.parse(fs.readFileSync(path.join(directory,'commands.json'),'utf8'));
    assert.equal(commands.length,1);assert.notEqual(commands[0].exitCode,0);assert(commands[0].stderr.includes('Access of undefined property absentName.'));
    passed.push('original strict Flex unresolved identifier diagnostic authenticated');
    return passed;
};
