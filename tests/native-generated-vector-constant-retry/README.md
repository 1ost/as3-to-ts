# Static Vector constants and variables

Complete unchanged Trace and Holder Classes and their namespace now emit through
the source-module factory. Public and namespace static Vector constants use
authenticated specialization descriptors and one-shot initialization. Private
static Vector constants use a lexical initializer capability. Static variables
retain ordinary Vector coercion. Instance/protected constants and missing
specialization authority remain rejected.

All 17 observations match two identical AIR captures on ES5/ES2015 in Node and
strict-CSP Chromium, with zero type diagnostics. The fixture covers int, String
and Function Vectors, null defaults, failed Class initialization, fresh retry
values, retained failed values, readonly bindings, mutable elements, fixed
length errors, assignment conversion and preservation after failed assignment.

Thirteen additional provider checks cover forged specialization/name rejection,
public and lexical initializer coercion, null storage after failed coercion,
exact value identity, one-shot initialization, readonly storage, unknown lexical
capabilities and wrong owners. Five compiler checks retain authority boundaries
and restore the old public static Vector guard. An applied runtime mutation
omits both private Vector initializers and must fail in both realms.

Adjacent static lexical Vector storage (28 AIR rows) and class-body retry
(13 rows) pass both targets and realms with zero type errors. The retained
3,327,000-byte archive includes compiler/source/type/bundle inputs, AIR evidence,
generated output, mutations and adjacent reports.

Run `npm run tsc`, then `node tests/native-generated-vector-constant-retry/run.cjs`.
Set LAYA_ENGINE_REPOSITORY and PLAYWRIGHT_MODULE for the local dependencies.
`verify.cjs --check-current` checks current bytes against retained evidence;
omit the flag for portable verification.

The initial probe's inline anonymous callback also matched AIR, but emission
then exposed the separate anonymous-function-in-static-initializer hold. Its
source, captures and original compiler rejection are retained separately. The
qualified storage cohort uses an authored named static callback and is captured
again in AIR. This does not qualify the original ListElement callback initializer;
that complete original declaration must still be replayed and advanced without
source rewriting. Complete factory and H5/account acceptance remain open.
