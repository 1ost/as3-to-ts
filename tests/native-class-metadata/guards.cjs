const assert=require('assert');
const {hash,authenticateMetadata}=require('./evidence.cjs');
exports.run=function(compiler,evidence){
    const parse=require(compiler+'/lib/parse'),emit=require(compiler+'/lib/emit');
    const sources=evidence.sources,metadata=evidence.metadata.classes,passed=[];
    const copy=value=>JSON.parse(JSON.stringify(value));
    function compile(input,records){
        const source=input['entryreview.Subject'];
        return emit(parse('Subject.as',source),source,{customVisitors:[],definitionsByNamespace:{},
            nativeClassInitialization:{classes:Object.fromEntries(Object.keys(input).map(name=>[name,'lazy']))},
            nativeCallableMethodBindingModule:'./AS3MethodBinding',nativeCallableCoercionModule:'./AS3MethodBinding',
            nativeCallableClasses:input,nativeCallableMetadata:{module:'./AS3MethodBinding',classes:records}});
    }
    for(const [name,change] of [
        ['source hash',x=>x['entryreview.Subject'].sourceSha256='0'.repeat(64)],
        ['declaration name',x=>x['entryreview.Subject'].metadata.name='wrong::Subject'],
        ['dynamic flag',x=>x['entryreview.Subject'].metadata.isDynamic=true],
        ['incomplete metadata',x=>x['entryreview.Subject'].metadata.instance.variables=[]],
        ['field type',x=>x['entryreview.Subject'].instanceTraits[0].type='Number'],
        ['invented trait',x=>x['entryreview.Subject'].staticTraits.push({name:'invented',kind:'variable',type:'*'})],
        ['forged inherited method',x=>x['entryreview.Subject'].metadata.instance.methods.push({name:'fake',declaredBy:'fake::Base',parameterCount:0})]]){
        const records=copy(metadata);change(records);assert.throws(()=>compile(sources,records),/AS3_CLASS_METADATA_UNSUPPORTED/);passed.push(name);
    }
    for(const [name,declaration] of [['private','private var hidden:int;'],['protected','protected function hidden():void {}'],['internal','internal var hidden:int;']]) {
        const input={...sources,'entryreview.Subject':sources['entryreview.Subject'].replace('public var n:int=7;',declaration+'public var n:int=7;')};
        assert.notEqual(input['entryreview.Subject'],sources['entryreview.Subject']);
        const records=copy(metadata);records['entryreview.Subject'].sourceSha256=hash(input['entryreview.Subject']);
        assert.throws(()=>compile(input,records),/nonpublic source members/);passed.push(name+' held');
    }
    for(const [name,statement] of [['method arguments','return arguments.length;'],['enumeration','for(var key:String in this) {} return 0;'],['unresolved typeof','return typeof absentName;']]){
        const input={...sources,'entryreview.Subject':sources['entryreview.Subject'].replace('public var n:int=7;','public var n:int=7; public function probe():* {'+statement+'}')};
        assert.notEqual(input['entryreview.Subject'],sources['entryreview.Subject']);
        const records=copy(metadata),record=records['entryreview.Subject'];record.sourceSha256=hash(input['entryreview.Subject']);
        record.metadata.instance.methods.push({name:'probe',declaredBy:'entryreview::Subject',parameterCount:0});record.instanceTraits.push({name:'probe',kind:'method'});
        assert.throws(()=>compile(input,records),/AS3_SOURCE_OPERATION_UNSUPPORTED/);passed.push(name+' held');
    }
    // A matching source hash and member set cannot authenticate member order.
    // These reject at the trusted-input boundary, not at the compiler's sorted validator.
    const reordered=copy(evidence.metadata);
    const methods=reordered.classes['entryreview.Probe'].metadata.statics.methods;
    assert(methods.length>1);methods.reverse();
    assert.throws(()=>authenticateMetadata(evidence,reordered),/exact authenticated capture/);passed.push('ordered metadata authentication');
    const changedCapture=copy(evidence.metadata);changedCapture.captureSha256='0'.repeat(64);
    assert.throws(()=>authenticateMetadata(evidence,changedCapture),/exact authenticated capture/);passed.push('capture authentication');
    const lower=require(compiler+'/lib/emit/native-source-operations').lowerNativeSourceOperations;
    let serial=0;
    const lowered=lower("import {as3Is as authored} from './CommonProvider'; function run(value:any){return authored(value);}",
        'provider',new Set(['generatedPredicate']),name=>name+(serial++));
    assert(lowered.includes('provider.as3CallValue(authored,()=>[value])'));
    assert(!lowered.includes('return authored(value)'));passed.push('authored provider import remains source-dispatched');
    return passed;
};
