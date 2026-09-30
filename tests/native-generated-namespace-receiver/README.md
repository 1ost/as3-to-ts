# Ordinary chained receivers across native ancestry

The namespace checker probes ordinary public dots for optional receiver types.
Previously, a call such as this.getBucket().toArrayCollection() eagerly required
a complete same-file namespace inheritance chain, rejecting an EventDispatcher
subclass even when the expression used no custom namespace. The optional probe
now returns unknown if ancestry cannot be established, consistently with the
existing ordinary-field probe. Explicit namespace chains and declarations retain
their strict ancestry requirements. No native-base allowlist or namespace
authority is added, and the common engine is unchanged.

Two complete source Classes, including the real native EventDispatcher base,
match eleven authenticated AIR 51.3.4.2 observations in Node and Chromium with
CSP script-src self, for ES5 and ES2015, with zero generated/provider type errors.
The source exercises direct method results, public fields, chained methods,
Quest-shaped enumeration, single evaluation and source-thrown values.

Four guards reject explicit namespace receiver chains and declarations across
unproven native/foreign ancestry. An applied compiler mutation restores the old
mandatory hierarchy lookup and makes complete subject emission fail on each
target; this proves that the regression fixture exercises the changed branch.

    node tests/native-generated-namespace-receiver/run.cjs
    node tests/native-generated-namespace-receiver/retain.cjs <run>/report.json
    node tests/native-generated-namespace-receiver/verify-runtime.cjs --check-current

Set LAYA_ENGINE_REPOSITORY to the engine checkout in runtime-pin.json.
The source, AIR receipt/artifacts, rows, runner, guards, compiler sources and
generated outputs/provider type inputs are authenticated by the retained report.

Related regression checks passed: native-namespaces (including provider isolation,
TLF slice, inherited execution and 17 inheritance guards), native-source-namespaces
(33 guards), native-namespace-updates (96 AIR rows on both targets, 13 boundaries),
native-inherited-static-namespace, generated source namespace publication (16
projected AIR rows and 11 native checks per target, both realms), and the complete
generated literal replacement consumer (26 AIR rows, both targets and realms).
The latter two reports are retained alongside this fixture at these exact inputs.

This is language/compiler qualification. QuestManager and real startup/account
behavior require separate application validation.
