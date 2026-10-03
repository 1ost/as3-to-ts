# Generated String method dispatch

Run `node tests/native-generated-string-methods/run.cjs` with
`LAYA_ENGINE_REPOSITORY` pointing to the matching engine checkout.

The fixture always enables OP2's generic Object property provider. Sixteen AIR
observations cover typed variables/parameters, wildcard values, String literals,
property and call chains, an explicit undefined slice end, a RegExp chain,
detached method identity, call/apply, arity errors and method length.
Each ES5/ES2015 target runs in Node and Chromium under strict script CSP, checks
three domain/state invariants, rejects a forged declaration plan, and rejects a
mutation that restores host lowercasing. Generated type checks must be empty.
Generated output is checked for escaped host slice/toLowerCase calls.

The known String lowering uses the shared named-call provider; it does not alter
custom classes with like-named methods. Chaining through an Object/wildcard
property retains dynamic dispatch on the returned value instead of coercing it
to String. Unknown private/source-typed receivers retain their existing routes.

Run the adjacent `native-generated-regexp-receivers/run.cjs --op2-dispatch`
fixture too: its prior String.slice failure must now pass all 31 AIR rows.
Its report records `objectDispatch` so the configuration is reviewable.
