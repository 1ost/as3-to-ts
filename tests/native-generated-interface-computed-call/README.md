# Computed calls on source-interface receivers

The compiler now sends computed calls on authenticated interface locals and
parameters through the common lexical call helper. Lookup and key/getter
failures precede argument evaluation; non-callable values still evaluate their
arguments before TypeError 1006. Call arguments retain source expression spans.
The exact FlowComposerBase conditional getBaseSWFContext shape is covered.

11 repeated AIR observations match ES5/ES2015 in Node and Chromium CSP, with
zero type errors. Six guards reject forged plans, missing read providers,
construction, writes, compound assignments and deletion. Two applied emitter
mutations detect public-only lookup and premature argument evaluation. The
38-row computed-read and 38-row Proxy regressions also pass both targets and
realms. The read fixture now keeps six guards because direct calls are admitted;
its historical packet remains immutable evidence of the earlier scope.

Run `npm run tsc`, then `node tests/native-generated-interface-computed-call/run.cjs`
with LAYA_ENGINE_REPOSITORY and PLAYWRIGHT_MODULE set. Verify the portable packet
with `node tests/native-generated-interface-computed-call/verify.cjs`.
The engine AIR authority is commit 7b3df2219; runtime prerequisite c820893d8
preserves null-before-key-conversion behavior. No runtime changes are needed
for calls. Whole-client and real H5 verification are still separate requirements.
