# Anonymous Boolean returns and source-reference predicates

Original TextFlow traversals use callbacks with a FlowElement parameter and
Boolean result. The lexical gate previously admitted only int results for source
Class parameters and rejected Boolean anonymous returns entirely.

The compiler now uses common Boolean return coercion, false for normal fallthrough,
and fixed typed arity (zero-parameter anonymous functions still accept extras).
Existing authenticated source-reference parameter conversion is also enabled with
Boolean results. Captured reference assignments retain their declared type.

The unchanged two-class AIR fixture contains 47 repeated observations covering
truthy/falsy values, null/undefined, non-coercing object truthiness, argument counts,
nominal parameters, function lengths and a traversal that captures its matching
item. ES5/ES2015 factories match Node and CSP Chromium with zero type errors,
three forged-object guards, five compiler guards, and three applied mutations per
target. Explicit returns, implicit completion and argument checking are each
necessary. Other return types, optional reference parameters, bare typed returns,
receiver-property access and missing coercion authority remain held.

Set LAYA_ENGINE_REPOSITORY, run npm run tsc, then run.cjs. verify.cjs --retain
<report.json> stores a reviewed packet once; --check-current validates its inputs.
The archive retains exact compiler/engine/types, source oracle artifacts, generated
factories and all executable mutant/baseline bundles. Adjacent anonymous Object
returns (17 rows) and String/rest parameters (19 rows) pass both targets/realms.
The parameter harness was run with its engine pin temporarily set to the current
isolated engine commit and then restored byte-for-byte; its historical pin is kept.

This is compiler qualification, not proof of complete TextFlow or H5 execution.
