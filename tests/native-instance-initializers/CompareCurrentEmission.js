const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');
const output = path.resolve(process.argv[2]);
const sourceDirectory = path.join(__dirname, 'oracle/instanceorder');
const names = ['Journal', 'Base', 'Explicit', 'Implicit', 'Leaf', 'FieldFailure', 'ThrowingBase', 'BaseFailure', 'Reentrant'];
const classes = Object.fromEntries(names.map(name => ['instanceorder.' + name, 'lazy']));
const flash = JSON.parse(fs.readFileSync(path.join(output, 'flash.json')));
const reports = [];
for (const target of [ts.ScriptTarget.ES5, ts.ScriptTarget.ES2015]) {
    const modules = new Map(), context = vm.createContext({});
    const directory = path.join(output, target === ts.ScriptTarget.ES5 ? 'es5' : 'es2015');
    fs.mkdirSync(directory, {recursive:true});
    function load(source, name) {
        const result = ts.transpileModule(source, {compilerOptions:{
            target, module:ts.ModuleKind.CommonJS, experimentalDecorators:true,
        }, reportDiagnostics:true});
        assert.deepEqual(result.diagnostics, []);
        const exports = modules.get(name) || {}; modules.set(name, exports);
        vm.runInContext('(function(exports,require){\n' + result.outputText + '\n})', context)(exports,
            request => { const key = request.split('/').pop(); assert(modules.has(key), request); return modules.get(key); });
        return exports;
    }
    for (const name of ['bound', 'classBound', 'nativeClass'])
        load(fs.readFileSync(path.join(__dirname, '../../utils/' + name + '.ts'), 'utf8'), name);
    names.forEach(name => modules.set(name, {}));
    for (const name of names) {
        const source = fs.readFileSync(path.join(sourceDirectory, name + '.as'), 'utf8');
        const native = emit(parse(name + '.as', source), source, {customVisitors:[], definitionsByNamespace:{},
            nativeClassInitialization:{classes}});
        fs.writeFileSync(path.join(directory, name + '.ts'), native);
        load(native, name);
    }
    const read = modules.get('nativeClass').readNativeClass;
    const get = name => read(modules.get(name)[name]);
    const Journal = get('Journal'), rows = Journal.rows;
    let unexpectedFailure = null;
    try {
    rows.push('explicit:start');
    const explicit = new (get('Explicit'))();
    rows.push('explicit:end:' + (explicit.self === explicit));
    rows.push('implicit:start'); new (get('Implicit'))(); rows.push('implicit:end');
    rows.push('leaf:start'); new (get('Leaf'))(); rows.push('leaf:end');
    for (let i = 0; i < 2; i++) {
        rows.push('field-failure:start:' + i);
        try { new (get('FieldFailure'))(); }
        catch (error) { rows.push('field-failure:caught:' + (error === Journal.failure)); }
    }
    rows.push('field-failure:fresh:' + (Journal.leaked[0] !== Journal.leaked[1]));
    rows.push('base-failure:start');
    try { new (get('BaseFailure'))(); }
    catch (error) { rows.push('base-failure:caught:' + (error === Journal.failure)); }
    rows.push('base-failure:leaked:' + Journal.baseLeaked.ready + ':' + (Journal.baseLeaked instanceof get('BaseFailure')));
    rows.push('reentrant:start');
    const outer = new (get('Reentrant'))();
    rows.push('reentrant:end:' + outer.value + ':' + Journal.nested.value + ':' + (outer !== Journal.nested));
    } catch (error) {
        unexpectedFailure = {name:error.name, message:error.message, errorID:error.errorID === undefined ? null : error.errorID};
    }
    const native = Array.from(rows);
    fs.writeFileSync(path.join(directory, 'native.json'), JSON.stringify(native, null, 2) + '\n');
    reports.push({target:target === ts.ScriptTarget.ES5 ? 'ES5' : 'ES2015', flashRows:flash.length,
        nativeRows:native.length, exactMatch:JSON.stringify(native) === JSON.stringify(flash),
        firstDifference:flash.findIndex((value,index) => value !== native[index]), unexpectedFailure, runtimeAdmission:false});
}
fs.writeFileSync(path.join(output, 'comparison.json'), JSON.stringify(reports, null, 2) + '\n');
console.log(JSON.stringify(reports, null, 2));
// This diagnostic deliberately returns failure for a fidelity mismatch.
if (reports.some(report => !report.exactMatch)) process.exitCode = 1;
