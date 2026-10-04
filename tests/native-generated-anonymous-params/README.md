# Anonymous String and rest parameters

The complete `cases.Parameters` class is captured twice in AIR 51.3.4 and emitted
through the shared factory for ES5 and ES2015. All 19 rows match in Node and CSP
Chromium, with no type errors. The previous compiler f8c121a4 rejects the same
source at anonymous String parameter qualification; `baseline.cjs` replays it.

Required String parameters coerce at entry and on ordinary assignment. Their
declared `typeof` remains String even for a null value. Fixed typed signatures
enforce arity; a rest signature admits trailing arguments. Wildcard rest
signatures retain AIR's missing-argument behavior. Rest arrays are fresh for
each call and are excluded from the registered `Function.length`.

Nine guards retain unsupported defaults, other scalar/Vector parameters,
arguments lookup, explicit receiver properties, nested named functions,
compound String parameter writes, rest-shadow storage and missing coercion
authority. Three emitted-code mutations remove fixed arity, rest minimum arity
or String assignment conversion; each is detected in both targets and realms.

Run `npm run tsc`, then `node tests/native-generated-anonymous-params/run.cjs`.
`engine.json` pins the engine. `verify.cjs` authenticates all original AIR bytes;
`verify-runtime.cjs --check-current` checks retained proof against current inputs.
The adjacent anonymous Object return and nested-closure suites retain 17 and 16
passing AIR rows respectively in `regressions.json.gz`. These checks do not
qualify the complete OP2 factory or H5/account flow. No font work is included.
