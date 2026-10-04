# XML traversal and source attribute writes

Run with the qualified common engine:

    $env:LAYA_ENGINE_REPOSITORY='../LayaAir-op2-xml-traversal-review'
    node tests/native-xml-traversal/run.cjs
    node tests/native-xml-traversal/verify-runtime.cjs --check-current

Two identical AIR captures supply sixteen observations. Complete generated AS3
classes match them on ES5 and ES2015 in Node and CSP Chromium with zero type
errors. The fixture exercises the maintained CollectionText traversal pattern:
all descendant node kinds, live attributes, dynamic attribute assignment,
String(attribute.name()), nested child writes, typed XMLList loops, null lists,
null receivers, and QName String conversion including nameless and namespace
qualified nodes. The engine's separate 26-row source mutation oracle covers
coercion ordering, target creation/cardinality and wildcard/live-node behavior.

Ten compiler rejection guards per target preserve provider/authority checks,
unsupported method arguments, compound writes, delete and a shadowed String.
An applied mutation that drops non-element descendants fails the original
comparison in both realms for both targets. The retained adjacent lexical XML
suite matches ten AIR observations with eight guards and a wrong-child control.
Packets pin compiler sources, generated/bundled inputs, runners and oracle bytes.

This is shared source/runtime qualification. It does not prove CollectionText's
full game dependencies, loading, rendering or real-account H5 behavior. Attribute
writes with namespace-qualified QName keys are not qualified here. No font work.
