const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ts = require('typescript');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');
require('./verify-oracle').verify();
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'native-class-types-'));
for (const name of ['nativeClass', 'bound', 'classBound'])
    fs.copyFileSync(path.join(__dirname, '../../utils', name + '.ts'), path.join(directory, name + '.ts'));
const names = ['Log', 'Base', 'Subject'];
const classes = Object.fromEntries(names.map(name => ['init.' + name, 'lazy']));
for (const name of names) {
    const source = fs.readFileSync(path.join(__dirname, 'oracle/init', name + '.as'), 'utf8');
    const output = emit(parse(name + '.as', source), source, {customVisitors: [], definitionsByNamespace: {}, nativeClassInitialization: {classes}});
    fs.writeFileSync(path.join(directory, name + '.ts'), output);
}
fs.writeFileSync(path.join(directory, 'Consumer.ts'), `
import { Subject } from './Subject';
import { readNativeClass } from './nativeClass';
const Constructor = readNativeClass(Subject);
const subject: Subject = new Constructor();
const field: number = subject.instance;
`);
for (const target of [ts.ScriptTarget.ES5, ts.ScriptTarget.ES2015]) {
    const options = {target, module: ts.ModuleKind.CommonJS, strict: true, strictNullChecks: false,
        lib: ['lib.es2015.d.ts'], experimentalDecorators: true, noEmit: true};
    const program = ts.createProgram(fs.readdirSync(directory).map(file => path.join(directory, file)), options);
    const diagnostics = ts.getPreEmitDiagnostics(program).map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    assert.deepEqual(diagnostics, []);
}
console.log('Strict TypeScript 2.4 consumer, inheritance, class value and instance type surface passed for ES5/ES2015');
