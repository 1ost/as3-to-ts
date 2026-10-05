# Opened static namespace methods with lexical namesakes

ComposeState and SimpleCompose call ParcelList.releaseParcelList while each
declares an inherited protected namesake. The foreign method belongs to the
opened tlf_internal namespace and is static. Lexical lowering now authenticates
an unshadowed source Class receiver before resolving the namespace method. It
uses the existing common QName property bridge for reads/calls. Instance method
resolution, namespace ambiguity and runtime qualifier shadowing remain guarded.

Five grouped observations from repeated AIR 51.3.4 runs match ES5/ES2015 in Node
and strict-CSP Chromium, with zero type errors. They cover typed arguments,
defaults, explicit/opened calls, Function identity/call receiver, lexical and
other-namespace isolation, and RHS exceptions. Nine guards cover unopened and
ambiguous namespaces, qualifier/Class shadowing, writes, providers, copied plans
and restoring the preceding receiver lookup. A wrong-URI runtime mutation is
detected in both realms. Target's static array uses existing Class-script retry
authority; the preceding compiler is also tested with that exact selection.

Run `npm run tsc`, then `node tests/native-generated-static-namespace-namesake/run.cjs`.
`node tests/native-generated-static-namespace-namesake/verify.cjs --check-current`
checks retained inputs and results. Adjacent instance namespace namesakes (16
rows) and private namespace keys (6 rows) pass both targets and runtimes.
Full factory/type/runtime and H5 acceptance remain open.
