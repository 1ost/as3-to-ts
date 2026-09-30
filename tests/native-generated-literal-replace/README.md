# Native literal String.replace

Complete source LiteralReplaceProbe is supplied by the pinned shared engine
fixture tests/nativeFlashOracle/literal-string-replace. Its 26 observations
come from two identical authenticated AIR 51.3.4.2 captures. No method body
is extracted or rewritten for this consumer test.

The compiler routes exactly two-argument replace calls on builtin String locals,
parameters, literals and String-only concatenations to sourceStringLiteralReplace
when the search is a String expression or primitive literal/keyword. Unknown
search types and unsupported RegExp constructions remain held. Regex replacement
continues through its existing separately qualified provider.

The generated loading-session factory executes in Node and Chromium under CSP
script-src self on ES5 and ES2015; every row matches, actual TypeScript diagnostics
are empty. Three rejection guards and three applied bundle mutations run per target.
The mutation controls change match selection, suffix slicing and callback offsets.

Run with LAYA_ENGINE_REPOSITORY pointing to the pinned engine checkout:

    node tests/native-generated-literal-replace/run.cjs
    node tests/native-generated-literal-replace/retain.cjs <run>/report.json
    node tests/native-generated-literal-replace/verify-runtime.cjs --check-current

Retained regressions include the complete generated regex-split (30 AIR rows)
and dynamic-regex replacement (14 AIR rows) consumers, both targets and realms,
zero type errors. Regex-token end/flag syntax checks also pass. The dynamic
consumer now honors LAYA_ENGINE_REPOSITORY for reproducible review checkouts.

This qualifies these intrinsic calls. Complete QuestManager emission and real
H5 startup/account behavior are separate application checks.
