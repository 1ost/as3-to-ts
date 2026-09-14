const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const ts=require('typescript'),parse=require('../../lib/parse'),emit=require('../../lib/emit');
require('../native-class-initializers/verify-oracle').verify();
function fixture(target, group, namespace, names) {
    const input=path.join(__dirname,'../native-class-initializers/oracle',group);
    const sources=Object.fromEntries(names.map(name=>[namespace+'.'+name,fs.readFileSync(path.join(input,namespace,name+'.as'),'utf8')]));
    const classes=Object.fromEntries(Object.keys(sources).map(name=>[name,'lazy']));
    const context=vm.createContext({}),modules=new Map();
    function load(source,name){
        const generated=ts.transpileModule(source,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});
        assert.deepEqual(generated.diagnostics,[]);
        const exports=modules.get(name)||{};modules.set(name,exports);
        vm.runInContext('(function(exports,require){\n'+generated.outputText+'\n})',context)(exports,request=>{
            const key=request.split('/').pop();assert(modules.has(key),request);return modules.get(key);
        });
    }
    load(require('./common-runtime').source(), 'AS3MethodBinding');
    for(const name of ['bound','classBound','nativeClass','callableClass'])load(fs.readFileSync(path.join(__dirname,'../../utils',name+'.ts'),'utf8'),name);
    names.forEach(name=>modules.set(name,{}));
    for(const name of names){const source=sources[namespace+'.'+name];load(emit(parse(name+'.as',source),source,
        {customVisitors:[],definitionsByNamespace:{},nativeClassInitialization:{classes},nativeCallableMethodBindingModule:"./AS3MethodBinding",nativeCallableCoercionModule:"./AS3MethodBinding",nativeCallableClasses:sources}),name);}
    return {read:name=>modules.get('nativeClass').readNativeClass(modules.get(name)[name]),
        flash:JSON.parse(fs.readFileSync(path.join(input,'flash.json')))};
}
for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
    const first=fixture(target,'','init',['Log','Base','Subject']);
    const rows=first.read('Log').rows;assert.equal(rows.length,0);rows.push('before-use');
    const Subject=first.read('Subject');rows.push('after-class-value');new Subject();new Subject();rows.push('after-two-instances');
    assert.deepEqual(Array.from(rows),first.flash,'Complete original15rows now include instance ordering');
    const pub=fixture(target,'publication','lifecycle',['Journal','First','Second','Failure']);
    const journal=pub.read('Journal'),trace=journal.rows;trace.push('before');
    const First=pub.read('First'),Second=pub.read('Second');
    trace.push('publication:'+(First.self===First)+':'+(First.other===Second)+':'+(Second.back===null));
    for(let i=0;i<2;i++){try{pub.read('Failure');trace.push('unexpected-success');}catch(error){trace.push('failure:'+(error===journal.failure));}}
    trace.push('fresh:'+(journal.leaked.length===2)+':'+(journal.leaked[0]!==journal.leaked[1]));
    assert.deepEqual(Array.from(trace),pub.flash);
    console.log('Callable source classes preserve original15-row full initialization and11-row lazy publication/failure traces for '+(target===ts.ScriptTarget.ES5?'ES5':'ES2015'));
}
