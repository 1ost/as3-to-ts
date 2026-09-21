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

const proxyOptions = {
    ...options,
    importModules: {
        'flash.utils.Proxy': './Proxy',
        'flash.utils.flash_proxy': './Proxy',
    },
    nativeReflectionQueryModule: undefined,
    nativeProxyModule: './Proxy',
};
const proxySource = `package probe {
 import flash.utils.Proxy;
 import flash.utils.flash_proxy;
 public class ReflectionProxy extends Proxy {
  public function ReflectionProxy() { super(); }
  public var declaredField:*;
  flash_proxy function getProperty(name:*):* { return null; }
 }
}`;
const proxyOutput = generate(proxySource, proxyOptions);
assert.match(proxyOutput, /extends Proxy/);
assert.match(proxyOutput, /protected\s+getProperty/);
assert.match(proxyOutput, /flashProxyDeclaredProperties/);
assert.doesNotMatch(proxyOutput, /namespace\.member/);

const sourceErrorOptions = {
    ...options,
    importModules: { 'flash.errors.AS3SourceError': './AS3SourceError' },
    nativeReflectionQueryModule: undefined,
    nativeSourceErrorModule: './AS3SourceError',
};
const sourceError = `package probe {
 public class SourceErrors {
  public function make():Object {
   return new Error("message", 7);
  }
  public function argument():Object {
   return new ArgumentError("argument");
  }
  public function reference():Object {
   return new ReferenceError();
  }
  public function shadow(Error:Function):Object {
   return new Error("shadow");
  }
 }
}`;
const sourceErrorOutput = generate(sourceError, sourceErrorOptions);
assert.match(sourceErrorOutput, /as3CreateError as __as3_as3CreateError/);
assert.match(sourceErrorOutput, /__as3_as3CreateError\("message", 7\)/);
assert.doesNotMatch(sourceErrorOutput, /__as3_as3CreateError\("message", 7\)\)/);
assert.match(sourceErrorOutput, /__as3_as3CreateArgumentError\("argument"\)/);
assert.match(sourceErrorOutput, /__as3_as3CreateReferenceError\(\)/);
assert.match(sourceErrorOutput, /new Error\("shadow"\)/);

assert.throws(() => generate(sourceError, {
    ...sourceErrorOptions,
    nativeSourceErrorModule: './other',
}), /AS3_SOURCE_ERROR_UNSUPPORTED/);

const numericOptions = {
    ...options,
    importModules: { 'flash.utils.AS3Coercion': './AS3Coercion' },
    nativeReflectionQueryModule: undefined,
    nativeNumericMethodParametersModule: './AS3Coercion',
};
const numericSource = `package probe {
 public class NumericParameters {
  public function read(value:int, amount:Number = 2, mask:uint = 3):Number {
   return value + amount + mask;
  }
 }
}`;
const numericOutput = generate(numericSource, numericOptions);
assert.match(numericOutput, /read\(value:number, amount\?:number, mask\?:number\)/);
assert.match(numericOutput, /as3CoerceInt as __as3_as3CoerceInt/);
assert.match(numericOutput, /arguments\.length <= 1 \? __as3_as3CoerceNumber\(2\)/);
assert.match(numericOutput, /arguments\.length <= 2 \? __as3_as3CoerceUint\(3\)/);
assert.doesNotMatch(numericOutput, /amount\?:number =/);
assert.match(generate(numericSource.replace('= 2', '= -2'), numericOptions),
    /__as3_as3CoerceNumber\(-2\)/);
assert.throws(() => generate(numericSource.replace('= 2', '= getDefault()'), numericOptions),
    /AS3_NUMERIC_PARAMETERS_UNSUPPORTED/);

const computedTypeOptions = {
    ...options,
    importModules: { 'flash.utils.AS3Type': './AS3Type' },
    nativeReflectionQueryModule: undefined,
    nativeComputedTypeTestModule: './AS3Type',
};
const computedTypeSource = `package probe {
 public class ComputedType {
  private var targets:Array;
  public function member(value:Object, index:int):Boolean {
   return value is this.targets[index];
  }
  public function call(value:Object):Boolean {
   return value is getTarget();
  }
  public function primitive(value:Object):Boolean {
   return value is Object;
  }
  private function getTarget():Class { return Object; }
 }
}`;
const computedTypeOutput = generate(computedTypeSource, computedTypeOptions);
assert.match(computedTypeOutput, /as3Is as __as3_source_is/);
assert.match(computedTypeOutput, /__as3_source_is\(value,\s*this\.targets\[index\]\)/);
assert.match(computedTypeOutput, /__as3_source_is\(value,\s*this\.getTarget\(\)\)/);
assert.match(computedTypeOutput, /value instanceof Object/);
assert.strictEqual((computedTypeOutput.match(/this\.targets\[index\]/g) || []).length, 1,
    'computed type target must be evaluated once');
assert.throws(() => generate(computedTypeSource, {
    ...computedTypeOptions,
    nativeComputedTypeTestModule: './other',
}), /AS3_COMPUTED_TYPE_TEST_UNSUPPORTED/);

const directStringOptions = {
    ...options,
    importModules: { 'compiler.AS3String': './AS3String' },
    nativeReflectionQueryModule: undefined,
    nativeDirectToStringModule: './AS3String',
};
const directStringSource = `package probe {
 public class DirectString {
  public function direct(value:Object):Object { return value.toString(); }
  public function argument(value:Object):Object { return value.toString(1); }
  public function receiver():Object { return getValue().toString(); }
  private function getValue():Object { return this; }
 }
}`;
const directStringOutput = generate(directStringSource, directStringOptions);
assert.match(directStringOutput, /as3InvokeToString as __as3_as3InvokeToString/);
assert.match(directStringOutput, /__as3_as3InvokeToString\(value\)/);
assert.match(directStringOutput, /__as3_as3InvokeToString\(this\.getValue\(\)\)/);
assert.match(directStringOutput, /value\.toString\(1\)/);
assert.strictEqual((directStringOutput.match(/this\.getValue\(\)/g) || []).length, 1,
    'direct toString receiver must be evaluated once');
assert.throws(() => generate(directStringSource, {
    ...directStringOptions,
    nativeDirectToStringModule: './other',
}), /AS3_DIRECT_TOSTRING_UNSUPPORTED/);

console.log('Native reflection query lowering passed');
