# Typed receiver chains rooted in lexical instance storage

BaseCompose calls this._curParcel.controller.isLineVisible while declaring its
own protected isLineVisible. The previous compiler lost the receiver type at
protected _curParcel:Parcel; the following public getter and opened namespace
could not be resolved. baseline-failure.json preserves a focused reproduction
and the prior compiler resolver source/JS.

Type discovery now follows exact declared types for this-instance private and
protected variables, including unqualified and inherited protected fields.
It reuses authenticated trait owner/type spans without evaluating the receiver.
Only the original caller can use its private field authority; foreign roots
still follow public declarations. Ordinary lexical reads and QName dispatch
retain access control, bound closures, getter counts, null errors and order.
No shared-engine runtime change or application-local substitute is introduced.

Run npm run tsc, then node tests/native-generated-lexical-receiver-chain/run.cjs.
The default engine is ../LayaAir-op2-lexical-receiver-chain-review, overridable
with LAYA_ENGINE_REPOSITORY. Two identical AIR 51.3.4 non-debugger captures give
31 observations. Unchanged source cohorts emit for ES5/ES2015 with zero strict
type errors and match in Node and strict-CSP Chromium. Eleven compiler guards
include inherited-private storage, foreign protected paths, static context,
non-public intermediate getter, missing/ambiguous/shadowed namespace authority,
method writes/construction and missing property authority. Four runtime namespace
guards remain exercised. Two applied mutations per target detect wrong methods
and repeated getter evaluation; the new lexical-chain rows detect both too.

The fixture checks protected/private fields, inherited and unqualified access,
receiver replacement during argument evaluation, captured method identity,
overrides and source null errors. Error class/ID are compared, not full strings.

verify.cjs --check-current authenticates retained compiler/engine sources,
original AIR artifacts, generated output and results. verify-adjacent.cjs retains
fresh public namespace, chained-interface and TextBlock regressions against the
same changed compiler. These checks do not prove complete BaseCompose emission,
full factory assembly or H5/account acceptance. Production pins remain separate.
