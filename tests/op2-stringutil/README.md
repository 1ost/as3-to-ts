# Complete maintained StringUtil differential check

Run node tests/op2-stringutil/run.cjs after npm run tsc. The full maintained source is authenticated against the retained AIR copy, emitted intact in the ordinary application consumer mode and checked against the real provider graph. A separate complete generated DynamicReplace class exercises the direct construction lowering.

All 36 AIR rows run on ES5/ES2015 in Node and Chromium; nine rejection guards retain match/replace call boundaries. The separate host observer mirrors the AIR observer, registering callbacks in a host source context and reading source error fields through the engine. Source methods and bodies are never changed.

Use `node tests/op2-stringutil/run.cjs --generated` to emit all three complete
StringUtil, DynamicReplace and PatternLocal subjects as generated Classes.
This compares 47 authenticated AIR rows on both targets/runtimes with zero type
errors and 38 rejection guards. Eleven additional rows check fresh local pattern
state per invocation, repeated global tests, Unicode input and omitted versus
explicit null/undefined inputs. The original ordinary-mode fixture stays intact.

The declaration input explicitly supplies `patternProviderModule` matching the
emitter's `nativeStringIntrinsicsModule`. A source proof admits only a directly
initialized method-local RegExp literal whose every use is a direct `.test()`
call after initialization. It rejects closures, redeclarations, assignments,
aliases, indexed access, other properties, identity queries, extra arguments and
source type shadowing. Pattern grammar retains the common provider's limits;
flags are empty or `g`. The registrar publishes StringUtil's actual source Class,
while `pattern-local` references grant no RegExp Class token or storage coercion.

RegExp Class identity, all Unicode/restriction combinations and application item
flows remain unqualified. These source bodies are never manually rewritten.
