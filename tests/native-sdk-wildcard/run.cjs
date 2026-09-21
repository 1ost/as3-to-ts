const assert = require('assert');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');
const ClassList = require('../../lib/emit/classlist').default;

const source = `package probe {
 import flash.utils.*;
 public class SDKWildcard {
  protected static var hasMethod:Boolean = describeType(ByteArray).factory.method.(@name == "uncompress").length() > 0;
  public function read():Boolean { return hasMethod; }
 }
}`;
const options = {
    lineSeparator: '\n',
    useNamespaces: false,
    customVisitors: [],
    definitionsByNamespace: { 'flash.utils': ['ByteArray', 'Dictionary', 'describeType'] },
    importModules: {
        'flash.utils.ByteArray': './ByteArray',
        'flash.utils.describeType': './describeType',
    },
    nativeReferencedWildcardImports: true,
    nativeReflectionQueryModule: './AS3ReflectionQuery',
};

function generate() {
    const previousList = ClassList.classList;
    const previousScanning = ClassList.isScanning;
    try {
        ClassList.classList = [];
        ClassList.isScanning = true;
        emit(parse('SDKWildcard.as', source), source, options);
        ClassList.optimize();
        ClassList.isScanning = false;
        return emit(parse('SDKWildcard.as', source), source, options);
    } finally {
        ClassList.classList = previousList;
        ClassList.isScanning = previousScanning;
    }
}

const output = generate();
assert.match(output, /import \{ ByteArray \} from "\.\/ByteArray"/);
assert.match(output, /import \{ describeType \} from "\.\/describeType"/);
assert.doesNotMatch(output, /Dictionary/);
assert.match(output, /as3DescribeTypeQueryLength/);
console.log('Native SDK wildcard lowering passed');
