const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const ts=require('typescript'),parse=require('../../lib/parse'),emit=require('../../lib/emit');
exports.fixture=function(target,sources,commonSource,metadata){
    const context=vm.createContext({}),modules=new Map();
    function load(source,name){
        const result=name==='AS3MethodBinding'?{outputText:source,diagnostics:[]}:ts.transpileModule(source,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});
        assert.deepEqual(result.diagnostics,[]);
        const exports=modules.get(name)||{};modules.set(name,exports);
        vm.runInContext('(function(exports,require){\n'+result.outputText+'\n})',context)(exports,request=>{
            const key=request.split('/').pop();assert(modules.has(key),request);return modules.get(key);
        });
    }
    load(commonSource || require('./common-runtime').source(), 'AS3MethodBinding');
    for(const name of ['bound','classBound','nativeClass','callableClass'])load(fs.readFileSync(path.join(__dirname,'../../utils',name+'.ts'),'utf8'),name);
    const classes=Object.fromEntries(Object.keys(sources).map(key=>[key,'lazy'])),generated={};
    for(const name of Object.keys(sources))modules.set(name.split('.').pop(),{});
    for(const [qname,source] of Object.entries(sources)){
        const name=qname.split('.').pop();
        generated[name]=emit(parse(name+'.as',source),source,{customVisitors:[],definitionsByNamespace:{},nativeClassInitialization:{classes},nativeCallableMethodBindingModule:"./AS3MethodBinding",nativeCallableCoercionModule:"./AS3MethodBinding",nativeCallableClasses:sources,nativeCallableMetadata:metadata});
        load(generated[name],name);
    }
    return {get:name=>modules.get('nativeClass').readNativeClass(modules.get(name)[name]),generated,
        common:modules.get('AS3MethodBinding'),context};
};
