const assert=require('assert'),fs=require('fs'),path=require('path'),ts=require('typescript');
const {fixture}=require('./callable-fixture');
require('./verify-evidence');
const input=path.join(__dirname,'review-original/adversary');
const sources=Object.fromEntries(fs.readdirSync(input).map(file=>['adversary.'+path.basename(file,'.as'),fs.readFileSync(path.join(input,file),'utf8')]));
const flash=JSON.parse(fs.readFileSync(path.join(__dirname,'review-original/flash.json')));
for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
    const {get}=fixture(target,sources),rows=[];
    for(const [name,args] of [['LocalSelf',[]],['ParameterSelf',[null]],['LocalError',[1]],['LocalObject',[]],['ParameterObject',[null]],['ParameterNumber',[null,7]],['ParameterError',[null,2]]]){
        try{const value=Reflect.construct(get(name),args);rows.push([name,'ok',value.n]);}
        catch(error){rows.push([name,'error',error.errorID]);}
    }
    const Subject=get('Subject'),subject=new Subject();subject.n=42;
    try{rows.push(['aliasCall','ok',Subject.replay(subject)]);}catch(error){rows.push(['aliasCall','error',error.errorID,subject.n]);}
    const FailureLeaf=get('FailureLeaf'),Root=get('Root'),leaked=[];
    for(let i=0;i<2;i++){try{new FailureLeaf();}catch(failure){leaked.push(failure);rows.push(['leak',failure.ready,failure.base,failure.self===failure,failure instanceof FailureLeaf,failure instanceof Root]);}}
    rows.push(['fresh',leaked[0]!==leaked[1]]);
    assert.deepEqual(rows,flash);
    for(const name of ['Object','Number','Error']){
        const src='package intrinsic {public class '+name+' {public var n:int; public function '+name+'(){}}}';
        const entry=fixture(target,{['intrinsic.'+name]:src}).get(name);
        assert.equal(new entry().n,0);
        assert.throws(()=>Reflect.construct(entry,[1]),error=>error.errorID===1063);
    }
    console.log('Independent Flash11-row hygiene/replay/failure capture and intrinsic-named source classes pass '+(target===ts.ScriptTarget.ES5?'ES5':'ES2015'));
}
