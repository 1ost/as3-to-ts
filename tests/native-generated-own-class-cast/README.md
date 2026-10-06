# Own source Class casts

Generated source Class casts now explicitly discard the evaluated Class with
`void`, preserving Class resolution before the operand without TS2695. An
own-Class cast used as a public member receiver also uses canonical dispatch,
matching AIR null error 1009 and evaluating call arguments before null failure.
Nominal coercion still rejects wrong types with 1034 before those arguments.

Two AIR captures in engine 3a16b69c3 establish six observations. ES5/ES2015
match in Node and strict-CSP Chromium with zero type errors, three rejection
guards and two compiler mutations: removing the discard restores six TS2695
errors; removing own-cast dispatch restores the raw JavaScript null error.
The existing 14-row cast-receiver suite also passes both targets/realms, its
eight guards and erased-coercion mutation. Its discovery mutation now targets
the exact cast branch because namespace discovery also assigns publicIdentity.

Run with LAYA_ENGINE_REPOSITORY and PLAYWRIGHT_MODULE set:

    npm run tsc
    node tests/native-generated-own-class-cast/run.cjs
    node tests/native-generated-cast-receiver/run.cjs
    node tests/native-generated-own-class-cast/verify.cjs --check-current

The packet retains positive/regression inputs, generated sources, executed
bundles, AIR authority, controls and baseline report. The baseline report and
Git baseline emitter are corroborating evidence; not every historical baseline
input is archived. Early unsuccessful probe configurations remain in ignored
cache; the retained configuration uses a named package and the inherited
lexical membership provider. Root-package AIR authority is separately retained.
These fixtures do not establish whole-client runtime or H5 account acceptance.
