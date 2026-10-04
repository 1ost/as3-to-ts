# Literal-prefixed trace expressions

The maintained CollectionMenuButton calls trace("Collection menu artwork: " +
event.text). The former compiler rejected its complete ErrorEvent expression.
The shared compiler now accepts literal-prefixed all-plus String expressions only
when common typed-local/source-addition lowering is active. Existing direct
String argument handling and lexical shadows remain unchanged. No engine or
maintained client source change is involved.

Run from this checkout with LAYA_ENGINE_REPOSITORY pointing to the isolated
engine at 75e76d4a8a934b1df307c37d9d6370ac6305f4fb:

    node tests/native-trace-string/run.cjs
    node tests/native-trace-string/verify-runtime.cjs --check-current

Two identical AIR 51.3.4 captures supply 16 actual stdout lines and two state
observations. Complete generated TraceSubject matches in Node and CSP Chromium
for ES5 and ES2015, with zero type errors. Cases include the exact ErrorEvent.text
expression, null/undefined, nested/numeric addition, object conversion hooks,
evaluation order and a thrown expression that must not produce partial output.
An applied helper mutation changing the String hint to Number is detected in both
realms/targets. Fifteen compiler checks retain unsupported-call, subtraction,
right-String and missing-authority rejection, plus parameter/member shadows.
The retained runtime verifier authenticates compiler, fixture, runner, guard,
observer, bundle and typecheck input bytes. baseline.log records the original
compiler rejection using the earlier, broader fixture now in right-string-hold.

The right-string-hold directory preserves a separate original AIR finding for
object + "suffix"; it is deliberately outside the newly enabled surface. Its
verify.cjs authenticates original evidence, not native equivalence. The existing
addition provider needs separate investigation before that form can be enabled.

The adjacent native-generated-dictionary-boundaries --combined suite reaches an
existing AS3_GENERATED_CLASS_UNSUPPORTED method-reference registration failure
with this compiler and the prior 9a58ee0 compiler, using the same current engine
and an in-memory require redirect. The test needed lib.dom.iterable to reach that
failure; that exploratory test-library change was reverted. No adjacent runtime
pass is claimed. This fixture establishes neither full button nor H5 acceptance.
