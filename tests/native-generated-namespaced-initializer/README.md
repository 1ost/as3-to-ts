# Namespaced constructor initializer and retry

Run `node tests/native-generated-namespaced-initializer/run.cjs` after building
the compiler. Engine evidence commit `a95bd3034` supplies three complete original
Classes plus a namespace declaration. Receipt/source/capture hashes are verified
before compilation. No runtime or compiler implementation change is needed.

All 20 original AIR observations match ES5/ES2015 in Node and Chromium: failed
constructor attempts expose distinct instances; earlier escaped globals and
closures retain their identities; success publishes the namespaced reference
once. QName reads/writes, null coercion and invalid reference rejection match.
The public namesake reads as undefined on the dynamic Class object.

Both targets pass zero type diagnostics, eleven declaration/emission guards and
five domain isolation/inheritance checks. An applied factory mutation replaces
the Class-script retry provider with the generic script provider, and fails the
retained-function check in both Node and Chromium. The namespace itself cannot
be selected as a Class-script unit. Retained report: `run-fiAUOp`; verify it with
`node tests/native-generated-namespaced-initializer/verify-runtime.cjs --check-current`.

This qualifies the generic initializer shape. Complete FlowElement dependencies,
factory execution and application/account flows remain separate requirements.
