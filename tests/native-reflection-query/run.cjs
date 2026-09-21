const assert = require('assert');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');
const ClassList = require('../../lib/emit/classlist').default;

const options = {
    lineSeparator: '\n',
    useNamespaces: false,
    customVisitors: [],
    definitionsByNamespace: {},
    importModules: { 'flash.utils.describeType': './AS3ReflectionQuery' },
    nativeReflectionQueryModule: './AS3ReflectionQuery',
};

function generate(source, opts = options) {
    const previousList = ClassList.classList;
    const previousScanning = ClassList.isScanning;
    try {
        ClassList.classList = [];
        ClassList.isScanning = true;
        emit(parse('ReflectionQuery.as', source), source, opts);
        ClassList.optimize();
        ClassList.isScanning = false;
        return emit(parse('ReflectionQuery.as', source), source, opts);
    } finally {
        ClassList.classList = previousList;
        ClassList.isScanning = previousScanning;
    }
}

const source = `package probe {
 import flash.utils.describeType;
 public class ReflectionQuery {
  public function read():int {
   return describeType(ReflectionQuery).factory.method.(@name == "optional").parameter.length();
  }
  public function once():int {
   return describeType(makeClass()).factory.method.(@name == "optional").parameter.length();
  }
  private function makeClass():Class { return ReflectionQuery; }
 }
}`;
const output = generate(source);
assert.match(output, /import \{ as3DescribeTypeQueryLength as __as3_describeTypeQueryLength \}/);
assert.match(output, /__as3_describeTypeQueryLength\(ReflectionQuery, \[\{"kind":"child","name":"factory"\}/);
assert.match(output, /__as3_describeTypeQueryLength\(this\.makeClass\(\),/);
assert.strictEqual((output.match(/__as3_describeTypeQueryLength\(this\.makeClass\(\),/g) || []).length, 1,
    'the receiver expression must be evaluated once');

const shadowed = `package probe {
 import flash.utils.describeType;
 public class ReflectionQuery {
  public function read():int {
   var describeType:Function = null;
   return describeType(ReflectionQuery).factory.method.(@name == "optional").parameter.length();
  }
 }
}`;
const shadowedOutput = generate(shadowed);
assert.doesNotMatch(shadowedOutput, /as3DescribeTypeQueryLength/);

const unsupported = source.replace('@name == "optional"', '@kind == getName()');
assert.throws(() => generate(unsupported), /AS3_REFLECTION_QUERY_UNSUPPORTED/);

console.log('Native reflection query lowering passed');
