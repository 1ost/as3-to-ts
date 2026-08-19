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

function executeGeneratedClass(generatedTypeScript, className) {
  // Remove unrelated decorator imports so focused tests can execute without
  // requiring a Flash bridge package.
  const executableTypeScript = generatedTypeScript
    .replace(/^import .*$/gm, '')
    .replace(/@classBound\s*/g, '')
    .replace(/@bound\s*/g, '')
    .replace('export class ' + className, 'class ' + className) +
    '\nthis.' + className + ' = ' + className + ';';
  const executableJavaScript = ts.transpileModule(executableTypeScript, {
    compilerOptions: { target: ts.ScriptTarget.ES2015 }
  }).outputText;
  const context = {};
  vm.runInNewContext(executableJavaScript, context);
  return context[className];
}

const Subject = executeGeneratedClass(output, 'IntUintAssignmentLowering');

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

const extendedSource = [
  'package {',
  'public class IntUintAssignmentExtended {',
  '  public var signed:int;',
  '  public var unsigned:uint;',
  '  public static var staticSigned:int;',
  '  public static var staticUnsigned:uint;',
  '  public var initializedSigned:int = -1;',
  '  public var initializedUnsigned:uint = -1;',
  '  public static var initializedStaticSigned:int = -1;',
  '  public static var initializedStaticUnsigned:uint = -1;',
  '',
  '  public function negativeDefaults(value:int = -1, unsignedValue:uint = -1):Array {',
  '    var localSigned:int = -1;',
  '    var localUnsigned:uint = -1;',
  '    var nestedSigned:int = -(1 + 2);',
  '    var nestedUnsigned:uint = -(1 + 2);',
  '    signed = -1;',
  '    unsigned = -1;',
  '    return [',
  '      localSigned, localUnsigned, nestedSigned, nestedUnsigned,',
  '      signed, unsigned, value, unsignedValue',
  '    ];',
  '  }',
  '',
  '  public function negativeCompound():Array {',
  '    signed = 0;',
  '    unsigned = 0;',
  '    return [signed += -1, unsigned += -1];',
  '  }',
  '',
  '  public function compounds(data:Object):Array {',
  '    var subSigned:int = 7;',
  '    var subUnsigned:uint = 1;',
  '    var mulSigned:int = 1073741824;',
  '    var mulUnsigned:uint = 4294967295;',
  '    var divSigned:int = -7;',
  '    var divUnsigned:uint = 7;',
  '    var modSigned:int = -7;',
  '    var modUnsigned:uint = 7;',
  '    var andSigned:int = 6;',
  '    var andUnsigned:uint = 4294967295;',
  '    var orSigned:int = -2147483648;',
  '    var orUnsigned:uint = 2147483648;',
  '    var xorSigned:int = -1;',
  '    var xorUnsigned:uint = 4294967295;',
  '    var shlSigned:int = 1073741824;',
  '    var shlUnsigned:uint = 2147483648;',
  '    var shrSigned:int = -1;',
  '    var shrUnsigned:uint = 4294967295;',
  '    var ushrSigned:int = -1;',
  '    var ushrUnsigned:uint = 4294967295;',
  '    return [',
  '      subSigned -= data.subSigned, subUnsigned -= data.subUnsigned,',
  '      mulSigned *= data.mulSigned, mulUnsigned *= data.mulUnsigned,',
  '      divSigned /= data.divSigned, divUnsigned /= data.divUnsigned,',
  '      modSigned %= data.modSigned, modUnsigned %= data.modUnsigned,',
  '      andSigned &= data.andSigned, andUnsigned &= data.andUnsigned,',
  '      orSigned |= data.orSigned, orUnsigned |= data.orUnsigned,',
  '      xorSigned ^= data.xorSigned, xorUnsigned ^= data.xorUnsigned,',
  '      shlSigned <<= data.shlSigned, shlUnsigned <<= data.shlUnsigned,',
  '      shrSigned >>= data.shrSigned, shrUnsigned >>= data.shrUnsigned,',
  '      ushrSigned >>>= data.ushrSigned, ushrUnsigned >>>= data.ushrUnsigned',
  '    ];',
  '  }',
  '',
  '  public function staticCompound(data:Object):Array {',
  '    IntUintAssignmentExtended.staticSigned = data.startSigned;',
  '    IntUintAssignmentExtended.staticUnsigned = data.startUnsigned;',
  '    return [',
  '      IntUintAssignmentExtended.staticSigned += data.addSigned,',
  '      IntUintAssignmentExtended.staticUnsigned += data.addUnsigned',
  '    ];',
  '  }',
  '',
  '  public function compoundOrder(data:Object):int {',
  '    signed = 1;',
  '    return signed += data.value;',
  '  }',
  '',
  '  public function exclusions(data:Object, values:Array, index:int):void {',
  '    data.signed = data.raw;',
  '    data.signed += data.raw;',
  '    data.signed <<= data.raw;',
  '    values[index] = data.raw;',
  '    values[index++] += data.raw;',
  '    data.values[data.nextIndex()] += data.raw;',
  '    signed++;',
  '    ++signed;',
  '    unsigned--;',
  '    --unsigned;',
  '  }',
  '',
  '  public function unprovenOrder(data:Object):void {',
  '    data.target().signed += data.value;',
  '    data.values[data.nextIndex()] += data.value;',
  '  }',
  '}}'
].join('\n');

const extendedOutput = emit(
  parse('IntUintAssignmentExtended.as', extendedSource),
  extendedSource,
  { lineSeparator: '\n', definitionsByNamespace: {}, customVisitors: [] }
).replace(/\r\n?/g, '\n');
const ExtendedSubject = executeGeneratedClass(
  extendedOutput,
  'IntUintAssignmentExtended'
);

// Unary prefixes must remain inside the destination coercion and occur once.
assert.match(extendedOutput, /value:number = \(Number\(-1\) \| 0\)/);
assert.match(extendedOutput, /unsignedValue:number = \(Number\(-1\) >>> 0\)/);
assert.doesNotMatch(extendedOutput, /\) \| 0\)-1|\) >>> 0\)-1/);
assert.doesNotMatch(extendedOutput, /= -\(Number\(/);

{
  const subject = new ExtendedSubject();
  assert.strictEqual(subject.initializedSigned, -1);
  assert.strictEqual(subject.initializedUnsigned, 4294967295);
  assert.strictEqual(ExtendedSubject.initializedStaticSigned, -1);
  assert.strictEqual(ExtendedSubject.initializedStaticUnsigned, 4294967295);
  assert.deepStrictEqual(
    Array.from(subject.negativeDefaults()),
    [
      -1, 4294967295, -3, 4294967293,
      -1, 4294967295, -1, 4294967295
    ]
  );
  assert.deepStrictEqual(
    Array.from(subject.negativeCompound()),
    [-1, 4294967295]
  );
}

{
  const subject = new ExtendedSubject();
  const values = {
    subSigned: 9,
    subUnsigned: 2,
    mulSigned: 2,
    mulUnsigned: 2,
    divSigned: 2,
    divUnsigned: 2,
    modSigned: 4,
    modUnsigned: 4,
    andSigned: 3,
    andUnsigned: 2147483647,
    orSigned: 1,
    orUnsigned: 1,
    xorSigned: 2147483647,
    xorUnsigned: 2147483647,
    shlSigned: 1,
    shlUnsigned: 1,
    shrSigned: 1,
    shrUnsigned: 1,
    ushrSigned: 1,
    ushrUnsigned: 1
  };
  const input = tracked(values);
  assert.deepStrictEqual(
    Array.from(subject.compounds(input.object)),
    [
      -2, 4294967295,
      -2147483648, 4294967294,
      -3, 3,
      -3, 3,
      2, 2147483647,
      -2147483647, 2147483649,
      -2147483648, 2147483648,
      -2147483648, 0,
      -1, 4294967295,
      2147483647, 2147483647
    ]
  );
  assert.deepStrictEqual(input.reads, Object.keys(values).reduce((result, key) => {
    result[key] = 1;
    return result;
  }, {}));
}

{
  const subject = new ExtendedSubject();
  const input = tracked({
    startSigned: 2147483647,
    startUnsigned: 4294967295,
    addSigned: 1,
    addUnsigned: 2
  });
  assert.deepStrictEqual(
    Array.from(subject.staticCompound(input.object)),
    [-2147483648, 1]
  );
  assert.deepStrictEqual(input.reads, {
    startSigned: 1,
    startUnsigned: 1,
    addSigned: 1,
    addUnsigned: 1
  });
}

{
  const subject = new ExtendedSubject();
  const events = [];
  const data = {};
  Object.defineProperty(data, 'value', {
    get() {
      events.push('get value');
      return {
        valueOf() {
          events.push('convert value');
          return 4294967297.75;
        }
      };
    }
  });
  assert.strictEqual(subject.compoundOrder(data), 2);
  assert.deepStrictEqual(events, ['get value', 'convert value']);
}

// This pass deliberately excludes targets whose receiver/index is not proven,
// and inc/dec nodes. The emitted source must remain single-evaluation syntax.
assert.match(extendedOutput, /data\.signed = data\.raw/);
assert.match(extendedOutput, /data\.signed \+= data\.raw/);
assert.match(extendedOutput, /data\.signed <<= data\.raw/);
assert.match(extendedOutput, /values\[index\] = data\.raw/);
assert.match(extendedOutput, /values\[index\+\+\] \+= data\.raw/);
assert.match(extendedOutput, /data\.values\[data\.nextIndex\(\)\] \+= data\.raw/);
assert.strictEqual((extendedOutput.match(/data\.nextIndex\(\)/g) || []).length, 2);
assert.match(extendedOutput, /this\.signed\+\+/);
assert.match(extendedOutput, /\+\+this\.signed/);
assert.match(extendedOutput, /this\.unsigned--/);
assert.match(extendedOutput, /--this\.unsigned/);
assert.doesNotMatch(extendedOutput, /data\.signed = \(Number/);
assert.doesNotMatch(extendedOutput, /values\[[^\]]+\] = \(Number/);

{
  const subject = new ExtendedSubject();
  const target = { signed: 1 };
  const values = [1];
  let targetCalls = 0;
  let indexCalls = 0;
  let valueReads = 0;
  const data = {
    target() {
      targetCalls++;
      return target;
    },
    values,
    nextIndex() {
      indexCalls++;
      return 0;
    }
  };
  Object.defineProperty(data, 'value', {
    get() {
      valueReads++;
      return 2;
    }
  });
  subject.unprovenOrder(data);
  assert.strictEqual(targetCalls, 1);
  assert.strictEqual(indexCalls, 1);
  assert.strictEqual(valueReads, 2);
  assert.strictEqual(target.signed, 3);
  assert.strictEqual(values[0], 3);
}

console.log('int/uint assignment lowering: all focused tests passed');
