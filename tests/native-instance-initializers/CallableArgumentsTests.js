const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const ts = require('typescript'), parse = require('../../lib/parse'), emit = require('../../lib/emit');
require('./verify-evidence');
const input = path.join(__dirname, 'arguments-original/callorder');
const names = ['Journal','Base','Subject','Plain'];
const sources = Object.fromEntries(names.map(name => ['callorder.' + name, fs.readFileSync(path.join(input,name+'.as'),'utf8')]));
const classes = Object.fromEntries(Object.keys(sources).map(key => [key,'lazy']));
const flash = JSON.parse(fs.readFileSync(path.join(__dirname,'arguments-original/flash.json')));
for (const target of [ts.ScriptTarget.ES5, ts.ScriptTarget.ES2015]) {
    const context = vm.createContext({}), modules = new Map();
    function load(source,name) {
        const result = name==='AS3MethodBinding'?{outputText:source,diagnostics:[]}:ts.transpileModule(source,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});
        assert.deepEqual(result.diagnostics,[]);
        const exports = modules.get(name) || {}; modules.set(name,exports);
        vm.runInContext('(function(exports,require){\n'+result.outputText+'\n})',context)(exports, request => {
            const key = request.split('/').pop(); assert(modules.has(key),request); return modules.get(key);
        });
    }
    load(require('./common-runtime').source(), 'AS3MethodBinding');
    for (const name of ['bound','classBound','nativeClass','callableClass']) load(fs.readFileSync(path.join(__dirname,'../../utils',name+'.ts'),'utf8'),name);
    names.forEach(name => modules.set(name,{}));
    for (const name of names) {
        const source=sources['callorder.'+name];
        load(emit(parse(name+'.as',source),source,{customVisitors:[],definitionsByNamespace:{},nativeClassInitialization:{classes},nativeCallableMethodBindingModule:"./AS3MethodBinding",nativeCallableCoercionModule:"./AS3MethodBinding",nativeCallableClasses:sources}),name);
    }
    const read = modules.get('nativeClass').readNativeClass;
    const get = name => read(modules.get(name)[name]);
    const Subject=get('Subject'), Base=get('Base'), Journal=get('Journal'), rows=Journal.rows;
    for(const args of [[],[5],[4294967297,-1.75],[1,2,3]]) {
        rows.push('attempt:'+args.length);
        try {Reflect.construct(Subject,args);} catch(error) {rows.push('arity-error:'+error.errorID);}
    }
    context.rows=rows; context.failure=Journal.failure; const convert=vm.runInContext("({valueOf(){rows.push('coerce');return 4294967297;}})",context);
    rows.push('conversion:start');
    const subject=new Subject(Journal.argument(convert),Journal.argument(-1.75));
    rows.push('identity:'+(subject.constructor===Subject)+':'+(subject instanceof Subject)+':'+(subject instanceof Base));
    const detached=subject.describe;
    rows.push('bound:'+(detached===subject.describe)+':'+detached.call({}));
    const failure=vm.runInContext("({valueOf(){rows.push('coerce-throw');throw failure;}})",context);
    try{new Subject(failure);}catch(error){rows.push('coerce-failure:'+(error===Journal.failure));}
    rows.push('explicit-undefined');new Subject(5,undefined);
    rows.push('plain-extra');try{Reflect.construct(get('Plain'),[1,2]);}catch(error){rows.push('plain-error:'+error.errorID);}
    assert.deepEqual(Array.from(rows),flash);
    assert.strictEqual(Object.getPrototypeOf(Subject),Base);
    assert.strictEqual(Object.getPrototypeOf(Subject.prototype),Base.prototype);
    assert.strictEqual(get('Subject'),Subject);
    console.log('Original Flash '+flash.length+' constructor argument/identity observations matched for '+(target===ts.ScriptTarget.ES5?'ES5':'ES2015'));
}
