# Private String compound addition

Run `npm run tsc`, then `node tests/native-generated-lexical-string-add/run.cjs --combined`.
Repeat with `--collision` to rename source parameters/locals to generated temporary
names and check that lowering preserves their bindings.

The complete StringStore from the engine AIR packet matches 20 observations on
ES5/ES2015 in Node and Chromium, with zero generated/dependency type errors.
Five rejection guards retain non-String, constant, other-operator and absent
addition-provider holds. Three comparison controls reject corrupted results.
Receiver/old value precede RHS effects; AS3 addition precedes String storage
conversion, and the expression returns the unconverted result. Primitive hints,
null/default values, a throwing conversion and private instance/static storage
are covered. Production uses existing common addition and lexical providers.

The module loader here is test-only. Production factory and application startup
remain separate integration requirements. Protected/internal/accessor compound
writes and non-String targets remain outside this qualified lowering.
