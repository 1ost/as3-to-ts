# Direct toString result typing

Run `node tests/native-direct-to-string/run.cjs` with sibling LayaAir-op2.
The emitted direct-call result crosses the common provider's unknown boundary
as a source wildcard, so a generated call to a String parameter type-checks.
This changes only TypeScript typing: it does not coerce a custom toString return.

The complete fixture is checked against the actual engine provider graph. A
negative control removes the boundary and must reproduce TS2345. ES5/ES2015
Node execution verifies raw object identity, a numeric return, a String argument
and one invocation. The actual OP2 routing probe independently type-checks the
complete OrderManager method that exposed the error. This is a typing regression
test, not new AIR behavior qualification.
