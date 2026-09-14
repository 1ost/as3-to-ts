const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');
const K = require('../../lib/syntax/nodeKind').default;
const ClassList = require('../../lib/emit/classlist').default;
require('./verify-oracle').verify();

function generate(source, classes) {
    return emit(parse('Fixture.as', source), source, {
        customVisitors: [], definitionsByNamespace: {},
        nativeClassInitialization: {classes},
    });
}

function runtime(target) {
    const context = vm.createContext({}), modules = new Map();
    function load(source, name) {
        const compiled = ts.transpileModule(source, {compilerOptions: {
            target, module: ts.ModuleKind.CommonJS, experimentalDecorators: true,
        }, reportDiagnostics: true});
        assert.deepEqual(compiled.diagnostics, [], source);
        const exports = modules.get(name) || {};
        modules.set(name, exports);
        vm.runInContext('(function(exports,require){\n' + compiled.outputText + '\n})', context)(exports, request => {
            const key = ['nativeClass', 'classBound', 'bound'].find(key => request.endsWith(key)) || request.split('/').pop();
            assert(modules.has(key), request); return modules.get(key);
        });
        modules.set(name, exports); return exports;
    }
    for (const name of ['bound', 'classBound', 'nativeClass'])
        load(fs.readFileSync(path.join(__dirname, '../../utils', name + '.ts'), 'utf8'), name);
    return {load, reserve(names) {names.forEach(name => modules.set(name, {}));}, read: modules.get('nativeClass').readNativeClass};
}

const statement = 'package p {public class C { public static var x:int=1; Other.activate([1,{}]); protected var next:int=2;}}';
const ast = parse('C.as', statement);
let initializers = [];
(function walk(node) {if (!node) return; if (node.kind === K.CLASS_INITIALIZER) initializers.push(node); node.children.forEach(walk);})(ast);
assert.equal(initializers.length, 1);
assert(statement.slice(initializers[0].start, initializers[0].end).includes('Other.activate([1,{}])'));
assert.throws(() => emit(ast, statement, {customVisitors: []}), /AS3_CLASS_INITIALIZER_UNSUPPORTED/);
for (const source of [
    'package p {public class C {[1,2]; public var field:*;}}',
    'package p {public class C {[field]; public var field:*;}}',
]) {
    const parsed = parse('C.as', source); let count = 0;
    (function walk(node) {if (!node) return; if (node.kind === K.CLASS_INITIALIZER) count++; node.children.forEach(walk);})(parsed);
    assert.equal(count, 1, 'array expression must not become metadata');
}
const metadataSource = 'package p {public namespace n="urn:n";public class C {[Inspectable] public var field:*; n /* comment */ var other:*;}}';
assert.doesNotThrow(() => emit(parse('C.as', metadataSource), metadataSource, {customVisitors: []}));
for (const classes of [{}, {'p.C': 'ready'}, Object.assign(Object.create({'p.C': 'lazy'}), {})])
    assert.throws(() => generate('package p {public class C {}}', classes), /AS3_CLASS_INITIALIZER_UNSUPPORTED/);
for (const body of ['Unknown.run();', '{var local:int=1;}', 'arguments[0];', 'this.field;',
    'public static var value:*=arguments[0];', 'public static var value:*=this;', 'public var field:*; use namespace n;'])
    assert.throws(() => generate('package p {public class C {' + body + '}}', {'p.C': 'lazy'}), /AS3_CLASS_INITIALIZER_UNSUPPORTED|AS3_NAMESPACE_UNSUPPORTED/);
assert.throws(() => generate('package p {public class C {public function f(value:*):* {return value as C;}}}', {'p.C': 'lazy'}), /AS3_CLASS_INITIALIZER_UNSUPPORTED/);
for (const receiver of ['Other', '(Other)', '((Other))', 'C', '(C)']) {
    for (const expression of [receiver + '["x"]', receiver + '[key()]', receiver + '["m"]()',
        receiver + '[key()] = 1', receiver + '["x"]++', 'delete ' + receiver + '["x"]']) {
        assert.throws(() => generate('package p {public class C {public static function key():String{return "x";} '
            + expression + ';}}', {'p.C': 'lazy', 'p.Other': 'lazy'}),
            /AS3_CLASS_INITIALIZER_UNSUPPORTED: indexed lazy-class receivers/, expression);
    }
}
assert.doesNotThrow(() => generate('package p {public class C {public function f(Other:Object):* {return Other["x"];}}}',
    {'p.C': 'lazy', 'p.Other': 'lazy'}), 'lexical receivers must not be mistaken for lazy class bindings');

for (const target of [ts.ScriptTarget.ES5, ts.ScriptTarget.ES2015]) {
    const rt = runtime(target), classes = {'init.Log': 'lazy', 'init.Base': 'lazy', 'init.Subject': 'lazy'};
    const handles = {};
    for (const name of ['Log', 'Base', 'Subject']) {
        const source = fs.readFileSync(path.join(__dirname, 'oracle/init', name + '.as'), 'utf8');
        handles[name] = rt.load(generate(source, classes), name)[name];
    }
    assert.throws(() => handles.Subject.prototype, /unresolved native class binding/);
    assert.throws(() => new handles.Subject(), /unresolved native class binding/);
    const rows = rt.read(handles.Log).rows;
    assert.equal(rows.length, 0, 'loading native modules must not run source initializers');
    rows.push('before-use');
    const Subject = rt.read(handles.Subject);
    rows.push('after-class-value');
    const flash = JSON.parse(fs.readFileSync(path.join(__dirname, 'oracle/flash.json')));
    assert.deepEqual(Array.from(rows), flash.slice(0, flash.indexOf('after-class-value') + 1));
    new Subject(); new Subject(); rows.push('after-two-instances');
    // Existing native constructor lowering orders derived instance field effects
    // after super(), unlike AS3. Preserve the full evidence and mark that separate
    // boundary; this workpack proves the class initialization prefix, not iinit.
    assert.equal(rows.filter(value => value === 'first-field').length, 1);
    assert.equal(rows.filter(value => value === 'subject-constructor').length, 2);
    assert.strictEqual(rt.read(handles.Subject), Subject, 'successful publication happens once');

    const selfSource = `package identity {public class Self {
        public static var stored:Class=Self;
        public static function classValue():Class{return Self;}
        public function classValue():Class{return Self;}
    }}`;
    const selfHandle = rt.load(generate(selfSource, {'identity.Self': 'lazy'}), 'Self').Self;
    const Self = rt.read(selfHandle);
    assert.strictEqual(Self.stored, Self);
    assert.strictEqual(Self.classValue(), Self);
    assert.strictEqual(new Self().classValue(), Self, 'source methods retain final decorated class identity');
    assert.strictEqual(new Self().constructor, Self, 'native prototype constructor retains final source class identity');

    const names = ['Journal', 'First', 'Second', 'Failure'];
    const identities = Object.fromEntries(names.map(name => ['lifecycle.' + name, 'lazy']));
    rt.reserve(names);
    const bindings = {};
    for (const name of names) {
        const source = fs.readFileSync(path.join(__dirname, 'oracle/publication/lifecycle', name + '.as'), 'utf8');
        bindings[name] = rt.load(generate(source, identities), name)[name];
    }
    const journal = rt.read(bindings.Journal), trace = journal.rows;
    assert.equal(trace.length, 0);
    trace.push('before');
    const First = rt.read(bindings.First), Second = rt.read(bindings.Second);
    trace.push('publication:' + (First.self === First) + ':' + (First.other === Second) + ':' + (Second.back === null));
    for (let index = 0; index < 2; index++) {
        try {rt.read(bindings.Failure); trace.push('unexpected-success');}
        catch (failure) {trace.push('failure:' + (failure === journal.failure));}
    }
    trace.push('fresh:' + (journal.leaked.length === 2) + ':' + (journal.leaked[0] !== journal.leaked[1]));
    assert.deepEqual(Array.from(trace), JSON.parse(fs.readFileSync(path.join(__dirname, 'oracle/publication/flash.json'))));

    const readNames = ['Journal', 'CastTarget', 'IsTarget', 'NewTarget'];
    const readIdentities = Object.fromEntries(readNames.concat('Driver').map(name => ['reads.' + name, 'lazy']));
    rt.reserve(readNames);
    for (const name of readNames) {
        const source = fs.readFileSync(path.join(__dirname, 'oracle/class-reads/reads', name + '.as'), 'utf8');
        bindings[name] = rt.load(generate(source, readIdentities), name)[name];
    }
    const driverSource = `package reads {public class Driver {
        public static function run():Array {
            var c:CastTarget=CastTarget(arg());Journal.rows.push("cast:"+(c===null));
            var test:Boolean=arg() is IsTarget;Journal.rows.push("is:"+test);
            var object:NewTarget=new NewTarget(arg());Journal.rows.push("new:"+(object is NewTarget));
            Journal.rows.push("constructor-identity:"+(Object(object).constructor===NewTarget));
            return Journal.rows;
        }
        private static function arg():*{Journal.rows.push("argument");return null;}
    }}`;
    const Driver = rt.read(rt.load(generate(driverSource, readIdentities), 'Driver').Driver);
    assert.deepEqual(Array.from(Driver.run()), JSON.parse(fs.readFileSync(path.join(__dirname, 'oracle/class-reads/flash.json'))));

    const cycleNames = ['Log', 'A', 'B', 'Failure'];
    const cycleIdentities = Object.fromEntries(cycleNames.map(name => ['probe.' + name, 'lazy']));
    rt.reserve(cycleNames);
    for (const name of cycleNames) {
        const source = fs.readFileSync(path.join(__dirname, 'oracle/cycles-errors/probe', name + '.as'), 'utf8');
        bindings[name] = rt.load(generate(source, cycleIdentities), name)[name];
    }
    const cycleLog = rt.read(bindings.Log), cycleTrace = cycleLog.rows;
    cycleTrace.push('before');
    for (const name of ['A', 'B', 'Failure']) for (let index = 0; index < 2; index++) {
        try {rt.read(bindings[name]); assert.fail('Cycle/error fixture must not publish');}
        catch (failure) {
            cycleTrace.push(name + '-failure-' + index + ':'
                + (name === 'Failure' ? (failure === cycleLog.failure) + ':' : '')
                + (failure === cycleLog.failure ? 'sentinel' : failure.errorID));
        }
    }
    assert.deepEqual(Array.from(cycleTrace), JSON.parse(fs.readFileSync(path.join(__dirname, 'oracle/cycles-errors/flash.json'))));

    const inheritedSources = {
        Ancestor: 'package inherited {public class Ancestor {public static var value:int=7; public static var ancestorOnly:int=8;}}',
        Descendant: 'package inherited {public class Descendant extends Ancestor {public static var value:int=9;public function readOwn():int{return value;}public function readInherited():int{return ancestorOnly;}public function shadow(value:int):int{return value;}}}',
    };
    const inheritedClasses = {'inherited.Ancestor': 'lazy', 'inherited.Descendant': 'lazy'};
    const previousList = ClassList.classList, previousScanning = ClassList.isScanning;
    try {
        ClassList.classList = []; ClassList.isScanning = true;
        for (const source of Object.values(inheritedSources)) generate(source, inheritedClasses);
        ClassList.optimize(); ClassList.isScanning = false;
        for (const [name, source] of Object.entries(inheritedSources)) bindings[name] = rt.load(generate(source, inheritedClasses), name)[name];
        const Descendant = rt.read(bindings.Descendant), instance = new Descendant();
        assert.equal(instance.readOwn(), 9); assert.equal(instance.readInherited(), 8); assert.equal(instance.shadow(12), 12);
        assert.strictEqual(instance.constructor, Descendant);
    } finally {ClassList.classList = previousList; ClassList.isScanning = previousScanning;}
    console.log('Native lazy class initialization and original Flash ordering passed for ' + ts.ScriptTarget[target]);
}
