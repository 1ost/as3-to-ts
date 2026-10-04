# Native TextBlock method reads with caller namesakes

BaseCompose passes `_loc5_.createTextLine` to an ISWFContext call while declaring
its own protected createTextLine. The previous compiler rejected that public
native receiver as caller lexical access. baseline-failure.json preserves the
unchanged focused source, diagnostic and exact previous resolver source/JS.

The compiler recognizes TextBlock's ten qualified public methods using the
native declaration identity and exact canonical reference/property providers.
Method reads use common property dispatch, preserving bound receiver, stable
identity and source arity; calls preserve arguments before null-receiver failure.
Private/protected caller capabilities remain separate. Method writes and method
construction are not admitted by this path. No native runtime changes are made.

Run npm run tsc, then node tests/native-generated-textblock-method-read/run.cjs.
The default engine is ../LayaAir-op2-textblock-method-read-review; override using
LAYA_ENGINE_REPOSITORY. Two identical AIR 51.3.4 non-debugger captures provide 35
observations. ES5 and ES2015 match in strict-CSP Chromium with Laya initialized:
ten method reads/null reads, same/different receiver identity and arity, source
fields, inherited namesakes, own protected dispatch, null argument evaluation,
and generated callInContext creating a real graphic-backed TextLine despite a
different supplied receiver. Bound release/recreate also preserve ownership.
Error class and ID are compared; full diagnostic strings are not qualified.

Each target has zero strict generated/dependency type errors, six compiler
rejection guards and two applied mutations (unstable dump closure and wrong
bound dump receiver). The observer constructs native inputs and records results;
the subject Caller, SubCaller, Context and interface are emitted unchanged from
the captured AS3 sources, not manually ported. This test does not replay the
complete application or qualify font-backed/mixed composition.

node tests/native-generated-textblock-method-read/verify.cjs --check-current
verifies the retained archive, source/receipt/SDK capture hashes, generated
artifacts, observations and negative controls. verify-adjacent.cjs validates
fresh chained-interface, namespace-namesake and native Timer regressions against
the same compiler/engine inputs. Full BaseCompose/factory and H5 account
acceptance remain separate required work. Production pins are unchanged.
