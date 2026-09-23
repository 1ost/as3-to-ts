# Generated source errors and Function locals

Run `npm run tsc`, `node tests/native-generated-source-errors/run.cjs`, and the
same runner with `--combined`. The engine's generated-source-errors evidence
packet authenticates two repeated AIR captures and six rejected direct-call
signatures. Two complete unchanged subjects match all 52 AIR rows on ES5/ES2015
in Node and Chromium, with zero generated/provider type diagnostics, thirteen
guards and three corrupted-comparison controls.

Generated constructor/method arity gates now use createAS3ArgumentCountError
when nativeSourceErrorModule is configured. The separate observer checks
constructor Error/ArgumentError identity; the complete subject catches missing
and extra method arguments inside its own typed Error catch. These failures
precede body entry. The legacy helper remains for emission without this provider;
that path does not qualify source Error identity.

Direct builtin Error, ArgumentError and ReferenceError calls require one
argument, as the retained AIR compiler rejects zero/two. They use the existing
common constructors and preserve wildcard message identity. The fixture compares
String, null, undefined, number and object messages and new-expression id coercion.
Source parameters shadowing those builtin names retain authored invocation.

Generated Function locals use common property coercion for initialization and
simple assignment, default to null, preserve valid method closures, normalize
undefined to null and return the raw RHS of a consumed assignment. Class, Array,
Object and numeric values fail with a genuine source TypeError 1034. The engine
now issues that source error for invalid Function reference coercion. Function
local compound updates, const storage and subclass-specific typed catches remain
explicitly held. General Error Class values/inheritance and exact diagnostic
message wording are outside this qualification.
