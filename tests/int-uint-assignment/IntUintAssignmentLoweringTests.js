const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');

const sourcePath = path.resolve(__dirname, '../simple/as3/IntUintAssignmentLowering.as');
const source = fs.readFileSync(sourcePath, 'utf8');
const output = emit(parse(path.basename(sourcePath), source), source, {
  lineSeparator: '\n',
  definitionsByNamespace: {},
  customVisitors: []
}).replace(/\r\n?/g, '\n');

// Dynamic Object reads are coerced at the proven typed destination. The
// transpiler must not invent an application JSON boundary or root validator.
assert.match(output, /this\.signed = \(Number\(data\.signed\) \| 0\)/);
assert.match(output, /this\.unsigned = \(Number\(data\.unsigned\) >>> 0\)/);
assert.match(output, /var localUnsigned:number = \(Number\(data\.initial\) >>> 0\)/);
assert.match(output, /return value = \(Number\(data\.value\) \| 0\)/);
assert.match(output, /signed = \(Number\(this\.signed \+ data\.addSigned\) \| 0\)/);
assert.match(output, /unsigned = \(Number\(this\.unsigned \+ data\.addUnsigned\) >>> 0\)/);
assert.match(output, /this\.ordinary = data\.value/);
assert.match(output, /data\.signed = data\.raw/);
assert.doesNotMatch(output, /this\.ordinary = \(Number/);
assert.doesNotMatch(output, /data\.signed = \(Number/);
assert.doesNotMatch(output, /requireJsonObject|decodeJson|JSON\.parse|JSON\.stringify/);

// Remove unrelated decorator imports so this focused test can execute the
// generated class without requiring a Flash bridge package.
const executableTypeScript = output
  .replace(/^import .*$/gm, '')
  .replace(/@classBound\s*/g, '')
  .replace(/@bound\s*/g, '')
  .replace(/export class IntUintAssignmentLowering/, 'class IntUintAssignmentLowering') +
  '\nthis.IntUintAssignmentLowering = IntUintAssignmentLowering;';
const executableJavaScript = ts.transpileModule(executableTypeScript, {
  compilerOptions: { target: ts.ScriptTarget.ES2015 }
}).outputText;
const context = {};
vm.runInNewContext(executableJavaScript, context);
const Subject = context.IntUintAssignmentLowering;

function tracked(values) {
  const reads = {};
  const object = {};
  Object.keys(values).forEach(key => {
    Object.defineProperty(object, key, {
      enumerable: true,
      get() {
        reads[key] = (reads[key] || 0) + 1;
        return values[key];
      }
    });
  });
  return { object, reads };
}

{
  const subject = new Subject();
  const input = tracked({
    initial: Infinity,
    signed: 4294967297.75,
    unsigned: -1.5,
    localSigned: NaN,
    localUnsigned: 4294967298.9
  });
  assert.deepStrictEqual(
    Array.from(subject.assign(input.object)),
    [1, 4294967295, 0, 2]
  );
  assert.deepStrictEqual(input.reads, {
    initial: 1,
    signed: 1,
    unsigned: 1,
    localSigned: 1,
    localUnsigned: 1
  });
}

{
  const subject = new Subject();
  const input = tracked({
    startSigned: 2147483647,
    startUnsigned: 4294967295,
    addSigned: 1,
    addUnsigned: 2
  });
  assert.deepStrictEqual(
    Array.from(subject.compound(input.object)),
    [-2147483648, 1, -2147483648, 1]
  );
  assert.deepStrictEqual(input.reads, {
    startSigned: 1,
    startUnsigned: 1,
    addSigned: 1,
    addUnsigned: 1
  });
}

{
  const subject = new Subject();
  const parameterInput = tracked({ value: -4294967297.25 });
  assert.strictEqual(subject.assignParameter(0, parameterInput.object), -1);
  assert.strictEqual(parameterInput.reads.value, 1);

  const returnInput = tracked({ value: Infinity });
  assert.strictEqual(subject.assignAndReturn(returnInput.object), 0);
  assert.strictEqual(subject.signed, 0);
  assert.strictEqual(returnInput.reads.value, 1);
}

{
  const subject = new Subject();
  const events = [];
  const data = {};
  Object.defineProperty(data, 'value', {
    get() {
      events.push('get value');
      return {
        valueOf() {
          events.push('convert value');
          return 4294967299.75;
        }
      };
    }
  });
  assert.strictEqual(subject.assignAndReturn(data), 3);
  assert.deepStrictEqual(events, ['get value', 'convert value']);
}

console.log('int/uint assignment lowering: all focused tests passed');
