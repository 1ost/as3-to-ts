const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ts = require('typescript');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');
const K = require('../../lib/syntax/nodeKind').default;
assert(process.argv[2], 'Pass the OP2 checkout path');
const root = path.resolve(process.argv[2]), folder = path.join(root, 'game-client-flash/src/com/greensock');
const file = path.join(folder, 'TweenMax.as'), source = fs.readFileSync(file, 'utf8');
assert.equal(crypto.createHash('sha256').update(source).digest('hex'), '3185383894fc9e3396d8574f9d98c921ff1a0ef5e1ff11e375e1b1d35857f1b2');
const classes = {};
function collect(directory) {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) collect(file);
        else if (entry.name.endsWith('.as')) {
            const text = fs.readFileSync(file, 'utf8');
            const pkg = /\bpackage\s+([\w.]+)/.exec(text), cls = /\bclass\s+(\w+)/.exec(text);
            if (pkg && cls) classes[pkg[1] + '.' + cls[1]] = 'lazy';
        }
    }
}
collect(folder);
// These names allow syntax-only emission of external native constructor reads.
// This test does not supply or claim runtime readiness for their providers.
Object.assign(classes, {'flash.events.EventDispatcher': 'ready', 'flash.events.Event': 'ready',
    'flash.display.DisplayObject': 'ready', 'flash.display.DisplayObjectContainer': 'ready'});
const child = (node, kind) => node.children.find(value => value && value.kind === kind);
const ast = parse('TweenMax.as', source), cls = child(child(child(ast, K.PACKAGE), K.CONTENT), K.CLASS);
const members = child(cls, K.CONTENT).children;
const initializer = members.filter(node => node && node.kind === K.CLASS_INITIALIZER);
assert.equal(initializer.length, 1);
assert(source.slice(initializer[0].start, initializer[0].end).startsWith('TweenPlugin.activate('));
const dispatcher = members.find(node => node && node.kind === K.VAR_LIST && child(child(node, K.NAME_TYPE_INIT), K.NAME).text === '_dispatcher');
assert.deepEqual(child(dispatcher, K.MOD_LIST).children.map(node => node.text), ['protected']);
assert.equal(child(dispatcher, K.META_LIST), undefined);
const output = emit(ast, source, {customVisitors: [], definitionsByNamespace: {}, nativeClassInitialization: {classes}});
const native = ts.createSourceFile('TweenMax.ts', output, ts.ScriptTarget.Latest, true);
assert.deepEqual(native.parseDiagnostics, []);
let nativeClass;
(function walk(node) {if (node.kind === ts.SyntaxKind.ClassDeclaration && node.name.text === 'TweenMax') nativeClass = node; ts.forEachChild(node, walk);})(native);
assert(nativeClass, 'Original class declaration must remain inside the factory');
const sourceMethods = members.filter(node => node && [K.FUNCTION, K.GET, K.SET].includes(node.kind)).length;
const nativeMethods = nativeClass.members.filter(node => [ts.SyntaxKind.Constructor, ts.SyntaxKind.MethodDeclaration,
    ts.SyntaxKind.GetAccessor, ts.SyntaxKind.SetAccessor].includes(node.kind)).length;
assert.equal(nativeMethods, sourceMethods, 'No source method/constructor may be dropped');
assert.equal((output.match(/\.activate\(/g) || []).length, 1);
const activation = output.indexOf('.activate(');
assert(activation > output.indexOf('["killDelayedCallsTo"] ='));
assert(activation > output.indexOf('["_overwriteMode"] ='));
assert.equal((output.slice(activation).match(/Plugin, "value"/g) || []).length, 19);
assert(output.slice(activation).includes(',{}]'));
for (const target of [ts.ScriptTarget.ES5, ts.ScriptTarget.ES2015])
    assert.deepEqual(ts.transpileModule(output, {compilerOptions: {target, experimentalDecorators: true}, reportDiagnostics: true}).diagnostics, []);
console.log(JSON.stringify({source: 'com/greensock/TweenMax.as', methodsRetained: sourceMethods, pluginClasses: 19,
    sentinelObject: true, syntaxPassed: true, runtimeAdmission: false}));
