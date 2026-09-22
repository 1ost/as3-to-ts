# Generated source-class as casts

Run npm run tsc, then node tests/native-generated-source-as/run.cjs. All seven
subjects from the shared engine generated-source-as packet are emitted intact.
The separate observer compares eleven AIR observations on ES5/ES2015 in Node
and Chromium, including target initialization for null/undefined, operand order,
nominal identity and mismatch behavior. Strict type checking uses real providers.

Lowering calls the common as3As helper with the operand followed by the actual
lazy Class read. It does not erase the cast as a TypeScript assertion or bypass
class initialization with a declaration token. Four rejection controls retain
missing-provider, initializer, shadowed Class operand and source is-test holds.
Native/interface targets and cyclic class reads remain held.
