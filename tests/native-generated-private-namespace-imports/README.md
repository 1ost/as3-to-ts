# Selected private-helper namespace imports

Namespace resolution now finds imports on the authenticated enclosing source unit
when the emitted AST is a selected private class. Class-level use directives are
not function-local directives; their empty emitted TypeScript member is skipped
by callable lowering. Function-local use remains explicitly held.

`npm run tsc` and `node tests/native-generated-private-namespace-imports/run.cjs`
match four grouped AIR observations on ES5/ES2015 in Node and strict-CSP Chromium
with zero type errors. Four guard checks include restoring each of the three old
behaviors and rejecting a function-local directive. A runtime public-name
substitution mutation is detected in both realms. Adjacent internal namespace
isolation (7 rows) and native EventDispatcher namespaces (12 rows) also pass.

`node tests/native-generated-private-namespace-imports/verify.cjs --check-current`
validates the retained source/provider/runner inputs, reports and captures. The
internal-isolation oracle comes from historical engine commit
75566b4bb4e2785f6bd7df6780a94902c4d02eef, exactly as that harness specifies;
the runtime/compiler inputs are current and retained. The initial fixture is
retained separately from its expanded this.read() check. Full H5 acceptance is open.
