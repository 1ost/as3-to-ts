# Complete private Boolean getters

Run `node tests/native-generated-private-getter/run.cjs --combined` with
`LAYA_ENGINE_REPOSITORY` pointing to the paired private-getter engine review.
Two complete source classes match eight twice-captured AIR rows on ES5/ES2015
in Node and strict-CSP Chromium, with zero generated/provider type errors.

Read-only private instance Boolean getters use declaration-owned lexical
capabilities. The observations cover unqualified and explicit-this reads,
peer receivers, repeated effects, changing backing state, base methods on child
instances and a child private getter with the same name. The owning getter is
selected even when the receiver has another private getter with that name.
An applied mutation negates the child's emitted getter result; both child-private
rows must differ on each target. Eight rejection guards cover static/non-Boolean
getters, setter halves, writes, calls, updates, deletion and invalid overrides.

The AIR observer is separate from the generated classes. `verify-air.cjs`
authenticates source bytes, receipt and repeated captures. `verify.cjs --retain
<report.json>` retains compiler/provider/type inputs and bundles once;
`node tests/native-generated-private-getter/verify.cjs --check-current` verifies
those bytes and all runtime comparisons and mutation outcomes.

This fixture qualifies private Boolean getter emission and runtime dispatch.
It does not prove complete ParcelList, a combined TLF factory, or native game
acceptance. Private setter halves, other private getter types and static getters
remain separate requirements.
