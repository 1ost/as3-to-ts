const assert = require('assert');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');
const ClassList = require('../../lib/emit/classlist').default;

const options = {
    lineSeparator: '\n',
    useNamespaces: false,
    customVisitors: [],
    definitionsByNamespace: {},
    importModules: { 'flash.utils.describeType': './describeType' },
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

const xmlOptions = {
    ...options,
    nativeReflectionQueryModule: undefined,
    nativeReflectionXMLModule: './AS3ReflectionQuery',
};
const xmlSource = `package probe {
 import flash.utils.describeType;
 public class ReflectionQuery {
  public function read(value:Object):String {
   var xml:XML = describeType(value);
   return describeType(value).@name.toString();
  }
  public function descendants(value:Object):int {
   return describeType(value)..method.length();
  }
 }
}`;
const xmlOutput = generate(xmlSource, xmlOptions);
assert.match(xmlOutput, /as3DescribeTypeXML as __as3_describeTypeXML/);
assert.match(xmlOutput, /as3XMLAttributeValue as __as3_xmlAttributeValue/);
assert.match(xmlOutput, /as3XMLDescendantsByName as __as3_xmlDescendantsByName/);
assert.match(xmlOutput, /__as3_xmlDescendantsByName\(__as3_describeTypeXML\(value\), "method"\)\.length/);

const wildcardXML = xmlSource.replace('..method.length()', '..*.(name() == "method").length()');
assert.throws(() => generate(wildcardXML, xmlOptions), /AS3_REFLECTION_XML_UNSUPPORTED/);

const globalOptions = {
    ...options,
    importModules: {},
    nativeReflectionQueryModule: undefined,
    nativeGlobalModules: { XML: './XML', QName: './QName' },
};
const globalSource = `package probe {
 public class ReflectionQuery {
  public function make():XML { return new XML("<a/>"); }
  public function preserve(XML:Function):XML { return new XML("<b/>"); }
 }
}`;
const globalOutput = generate(globalSource, globalOptions);
assert.match(globalOutput, /import \{ XML as __as3_global_XML \} from "\.\/XML"/);
assert.match(globalOutput, /new __as3_global_XML/);
assert.doesNotMatch(globalOutput, /import \{ XML \} from/);

console.log('Native reflection query lowering passed');
