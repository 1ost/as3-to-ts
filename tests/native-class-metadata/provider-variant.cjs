// Exercise the public compiler option with a provider name different from the
// method-binding module. This loader supplies both imports from the same real
// engine bundle; it does not alter generated source or substitute engine behavior.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
exports.fixture=function(compiler,target,sources,commonSource,metadata) {
    const ts=require(path.join(compiler,'node_modules/typescript')),parse=require(path.join(compiler,'lib/parse')),emit=require(path.join(compiler,'lib/emit'));
    const context=vm.createContext({}),modules=new Map(),generated={};
    function load(source,name) {
        const built=name==='AS3MethodBinding'?{outputText:source,diagnostics:[]}:ts.transpileModule(source,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});
        assert.deepStrictEqual(built.diagnostics,[]);
        const exports=modules.get(name)||{};modules.set(name,exports);
        vm.runInContext('(function(exports,require){'+built.outputText+'\n})',context)(exports,request=>{
            const key=request.split('/').pop();assert(modules.has(key),request);return modules.get(key);
        });
    }
    load(commonSource,'AS3MethodBinding');modules.set('CommonProvider',modules.get('AS3MethodBinding'));
    for(const name of ['bound','classBound','nativeClass','callableClass'])load(fs.readFileSync(path.join(compiler,'utils',name+'.ts'),'utf8'),name);
    for(const qname of Object.keys(sources))modules.set(qname.split('.').pop(),{});
    const classes=Object.fromEntries(Object.keys(sources).map(qname=>[qname,'lazy']));
    for(const [qname,source] of Object.entries(sources)) {
        const name=qname.split('.').pop();
        generated[name]=emit(parse(name+'.as',source),source,{customVisitors:[],definitionsByNamespace:{},nativeClassInitialization:{classes},
            nativeCallableMethodBindingModule:'./AS3MethodBinding',nativeCallableCoercionModule:'./AS3MethodBinding',nativeCallableClasses:sources,nativeCallableMetadata:metadata});
        load(generated[name],name);
    }
    return {get:name=>modules.get('nativeClass').readNativeClass(modules.get(name)[name]),generated,context,common:modules.get('AS3MethodBinding')};
};
