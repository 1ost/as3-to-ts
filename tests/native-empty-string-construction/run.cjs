const assert = require('assert');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');
const ClassList = require('../../lib/emit/classlist').default;

const options = {
    lineSeparator: '\n',
    useNamespaces: false,
    customVisitors: [],
    definitionsByNamespace: {},
    importModules: { 'compiler.AS3String': './AS3String' },
    nativeStringCoercionModule: './AS3String',
};

function generate(source) {
    const previousList = ClassList.classList;
    const previousScanning = ClassList.isScanning;
    try {
        ClassList.classList = [];
        ClassList.isScanning = true;
        emit(parse('EmptyStringConstruction.as', source), source, options);
        ClassList.optimize();
        ClassList.isScanning = false;
        return emit(parse('EmptyStringConstruction.as', source), source, options);
    } finally {
        ClassList.classList = previousList;
        ClassList.isScanning = previousScanning;
    }
}

const constructed = `package probe {
 public class EmptyStringConstruction {
  public function make():String { return new String(); }
 }
}`;
const output = generate(constructed);
assert.match(output, /return ""/);
assert.doesNotMatch(output, /new String/);

const callable = constructed.replace('new String()', 'String()');
assert.throws(() => generate(callable), /AS3_STRING_COERCION_UNSUPPORTED/);

console.log(JSON.stringify({ status: 'pass', checks: 3 }));
