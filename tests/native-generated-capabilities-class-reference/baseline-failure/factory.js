import * as __provider0 from "../../utils/nativeClass";
import * as __provider1 from "../../utils/callableClass";
import * as __provider2 from "../../../engine/src/layaAir/flash/errors/AS3SourceError";
import * as __provider3 from "../../../engine/src/layaAir/flash/utils/AS3GeneratedClass";
import * as __provider4 from "../../../engine/src/layaAir/flash/utils/AS3ScriptGlobal";
import * as __provider5 from "../../../engine/src/layaAir/flash/utils/AS3Class";
import * as __provider6 from "../../../engine/src/layaAir/flash/utils/AS3LexicalMembers";
import * as __provider7 from "../../../engine/src/layaAir/flash/utils/AS3Property";
import * as __provider8 from "../../../engine/src/layaAir/flash/utils/AS3MethodBinding";
import * as __provider9 from "../../../engine/src/layaAir/flash/utils/AS3ArrayCreation";
import * as __provider10 from "../../../engine/src/layaAir/flash/utils/NativeSourceClassLoadingSession";
import * as __provider11 from "../../../engine/src/layaAir/flash/system/Capabilities";
const __external = new Map([["../../utils/nativeClass",__provider0],["../../utils/callableClass",__provider1],["../../../engine/src/layaAir/flash/errors/AS3SourceError",__provider2],["../../../engine/src/layaAir/flash/utils/AS3GeneratedClass",__provider3],["../../../engine/src/layaAir/flash/utils/AS3ScriptGlobal",__provider4],["../../../engine/src/layaAir/flash/utils/AS3Class",__provider5],["../../../engine/src/layaAir/flash/utils/AS3LexicalMembers",__provider6],["../../../engine/src/layaAir/flash/utils/AS3Property",__provider7],["../../../engine/src/layaAir/flash/utils/AS3MethodBinding",__provider8],["../../../engine/src/layaAir/flash/utils/AS3ArrayCreation",__provider9],["../../../engine/src/layaAir/flash/utils/NativeSourceClassLoadingSession",__provider10],["../../../engine/src/layaAir/flash/system/Capabilities",__provider11]]);
const __bodies = new Map([
["./__native_declarations", function(exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Compiler-only declaration identities; no source class implementation imports.
const AS3GeneratedClass_1 = require("../../../engine/src/layaAir/flash/utils/AS3GeneratedClass");
const AS3ScriptGlobal_1 = require("../../../engine/src/layaAir/flash/utils/AS3ScriptGlobal");
const cohortDomain_1 = require("./cohortDomain");
var Capabilities_1 = require("../../../engine/src/layaAir/flash/system/Capabilities");
exports.native0 = Capabilities_1.Capabilities;
const __inherited_type0 = AS3ScriptGlobal_1.selectAS3ScriptDomainClass(cohortDomain_1.scriptDomain, "caps::Reader");
const __authority_type0 = __inherited_type0 ? null : AS3GeneratedClass_1.declareAS3ReferenceType("caps::Reader");
exports.type0 = __inherited_type0 ? __inherited_type0.declaration : __authority_type0.type;
exports.publish0 = (constructor) => { if (!__authority_type0)
    throw new TypeError("Inherited Class cannot publish a child generation"); return __authority_type0.publishGeneration(constructor); };
exports.lexical0 = new WeakMap();
exports.publishScript0 = (factory) => __inherited_type0 ? __inherited_type0.resolve() : AS3ScriptGlobal_1.instantiateAS3ClassScriptUnit(cohortDomain_1.scriptDomain, { "sourceId": "caps.Reader", "sourceSha256": "fe541d932067405fbf57414eac98ce71366a6d1eb3286c7a3f598abfe5c7dd82", "bindings": [{ "name": "Reader", "uri": "caps", "kind": "constant", "type": "caps::Reader" }] }, context => [{ name: "Reader", uri: "caps", value: factory(context.global) }]).export("Reader", "caps");
const AS3LexicalMembers_1 = require("../../../engine/src/layaAir/flash/utils/AS3LexicalMembers");
AS3LexicalMembers_1.bindAS3InternalPackage([exports.type0]);

}],
["./__native_class_0", function(exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const __as3_callable_provider = require("../../../engine/src/layaAir/flash/utils/AS3GeneratedClass");
const __as3_generated_lexicalProvider_0 = require("../../../engine/src/layaAir/flash/utils/AS3LexicalMembers");
const __as3_callable_generatedProperty = require("../../../engine/src/layaAir/flash/utils/AS3Property");
const __as3_callable_declarationDomain = require("./__native_declarations");
const callableClass_1 = require("../../utils/callableClass");
const AS3SourceError_1 = require("../../../engine/src/layaAir/flash/errors/AS3SourceError");
const __as3_callable_classValue = require("../../../engine/src/layaAir/flash/utils/AS3Class");
const AS3MethodBinding_1 = require("../../../engine/src/layaAir/flash/utils/AS3MethodBinding");
const nativeClass_1 = require("../../utils/nativeClass");
const AS3ArrayCreation_1 = require("../../../engine/src/layaAir/flash/utils/AS3ArrayCreation");
const Capabilities_1 = require("../../../engine/src/layaAir/flash/system/Capabilities");
exports.Reader = nativeClass_1.declareNativeClass((__as3_classValue_2_finalize) => {
    return __as3_callable_declarationDomain.publishScript0((__as3_generated_scriptGlobal_2) => {
        let __as3_classValue_2;
        const Reader = function Reader() {
            const __as3_callable_fresh = callableClass_1.callableClassIntrinsics.enter(this, __as3_callable_identity);
            let __as3_callable_succeeded = false;
            try {
                if (arguments.length < 0 || arguments.length > 0) {
                    throw AS3SourceError_1.createAS3ArgumentCountError();
                }
                if (__as3_callable_fresh) {
                    __as3_callable_generation.enterInstance(this);
                    __as3_generated_lexicalProvider_0.initializeAS3LexicalInstance(__as3_generated_lexicalScope_1, this);
                    AS3MethodBinding_1.bindAS3Method(this, "read");
                    AS3MethodBinding_1.bindAS3Method(this, "identity");
                }
                __as3_callable_succeeded = true;
            }
            finally {
                callableClass_1.callableClassIntrinsics.leave(this, __as3_callable_identity, __as3_callable_succeeded);
            }
        };
        const __as3_callable_identity = callableClass_1.callableClassIntrinsics.constructorIdentity(Reader);
        callableClass_1.callableClassIntrinsics.defineProperty(Reader.prototype, "constructor", { value: Reader, writable: false, configurable: true });
        callableClass_1.callableClassIntrinsics.register(__as3_callable_identity, null);
        callableClass_1.callableClassIntrinsics.defineProperty(Reader.prototype, "read", { value: function () {
                if (arguments.length < 0 || arguments.length > 0)
                    throw AS3SourceError_1.createAS3ArgumentCountError();
                return __as3_callable_generatedProperty.coerceAS3PropertyValue((AS3ArrayCreation_1.as3CreateArrayLiteral([__as3_generated_lexicalProvider_0.as3GetLexicalMember(__as3_classValue_2, __as3_generated_access_4), typeof Capabilities_1.Capabilities.os, typeof Capabilities_1.Capabilities.version, Capabilities_1.Capabilities["touchScreenType"] === undefined])), { name: "Array", reference: callableClass_1.callableClassIntrinsics.array });
            }, writable: true, configurable: true, enumerable: false });
        callableClass_1.callableClassIntrinsics.defineProperty(Reader.prototype, "identity", { value: function () {
                if (arguments.length < 0 || arguments.length > 0)
                    throw AS3SourceError_1.createAS3ArgumentCountError();
                var c = null;
                var c = __as3_callable_classValue.as3CoerceClass(Capabilities_1.Capabilities);
                return __as3_callable_generatedProperty.coerceAS3PropertyValue(c === Capabilities_1.Capabilities, "Boolean");
            }, writable: true, configurable: true, enumerable: false });
        callableClass_1.callableClassIntrinsics.defineProperty(Reader, "prototype", { writable: false });
        const __as3_callable_generation = __as3_callable_provider.registerAS3GeneratedClass(__as3_callable_identity, { metadata: { "name": "caps::Reader", "base": "Object", "isDynamic": false, "isFinal": false, "instance": { "variables": [], "constants": [], "methods": [{ "name": "read", "declaredBy": "caps::Reader", "parameterCount": 0 }, { "name": "identity", "declaredBy": "caps::Reader", "parameterCount": 0 }], "accessors": [] }, "statics": { "variables": [], "constants": [], "methods": [], "accessors": [] } }, instanceTraits: [{ name: "read", kind: "method" }, { name: "identity", kind: "method" }], staticTraits: [], instanceConstants: [], instanceAccessors: [], instanceMethods: [{ name: "identity", parameters: [], returns: "Boolean", requiredCount: 0, override: false, final: false }], declaration: { type: __as3_callable_declarationDomain.type0, publishGeneration: __as3_callable_declarationDomain.publish0 } });
        const __as3_generated_lexicalScope_1 = __as3_generated_lexicalProvider_0.registerAS3LexicalMembers(__as3_callable_identity, null, [{ name: "isMac", visibility: "private", static: true, kind: "variable", type: "Boolean" }]);
        __as3_callable_declarationDomain.lexical0.set(__as3_callable_identity, __as3_generated_lexicalScope_1);
        const __as3_generated_access_4 = __as3_generated_lexicalProvider_0.resolveAS3LexicalMember(__as3_generated_lexicalScope_1, "isMac", "private", true);
        __as3_callable_classValue.registerAS3Constructor(__as3_callable_identity, { minimum: 0, maximum: 0, coerceArguments: (values) => values });
        __as3_classValue_2 = __as3_classValue_2_finalize(Reader);
        __as3_generated_lexicalProvider_0.as3SetLexicalMember(__as3_classValue_2, __as3_generated_access_4, Capabilities_1.Capabilities.os.search("Mac OS") > -1);
        return Reader;
    });
});

}]
]);
export function bindNativeSourceClasses(domain) {
  const cache = new Map([["./cohortDomain", {"scriptDomain": domain}]]);
  let failed = false, failure;
  function load(name) {
    if (failed) throw failure;
    if (__external.has(name)) return __external.get(name);
    if (cache.has(name)) return cache.get(name);
    if (!__bodies.has(name)) throw new Error("Unbound native cohort module: " + name);
    const exports = Object.create(null); cache.set(name, exports);
    try { __bodies.get(name)(exports, load); }
    catch (error) { failed = true; failure = error; cache.clear(); throw error; }
    return exports;
  }
  const headers = load("./__native_declarations");
  return [
    {name:"caps.Reader",declaration:headers["type0"],resolve:()=>__provider0.readNativeClass(load("./__native_class_0")["Reader"],"value")}
  ];
}
export const nativeSourceClassModule = __provider10.createNativeSourceClassModule(async () => bindNativeSourceClasses);
