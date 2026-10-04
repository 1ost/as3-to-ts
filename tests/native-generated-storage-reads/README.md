# Lexical Array and Object storage reads

Reads rooted in authenticated private/protected/internal Array and Object variables
now use the shared AS3 property provider. The compiler retains lexical visibility,
recognizes only intrinsic source types, evaluates receiver and computed keys once,
and preserves null (1009) versus undefined (1010) errors. Calls, writes, updates and
deletes retain their separate lowering paths. No engine or game-source fix is used.

Evidence at engine bfa25854370b31fdef23fe6451828c87da157f40:

- Complete maintained CustomEase/Segment with original authored curve values and
  modern GSAP: all 34 existing AIR rows match (previously 32).
- 18 new rows captured identically twice with AIR 51.3.4: implicit/explicit private
  and static Arrays, holes and null entries, Object registries, local shadowing,
  and key functions that replace the storage while the read is in progress.
- ES5 and ES2015, Node and strict-CSP Chromium; zero type errors, including the
  native observers. Four type/shadowing guards plus the existing omitted-source guard.
- Applied controls in both runtimes: corrupt the GSAP ease, and restore raw reads.
  The latter reproduces both original CustomEase failures plus four field failures.
- Adjacent checks: Object conversion/property 17, source-unit retry 58, Array sort
  8, and public Array accessors 22 rows (105 total), retaining their guards/controls.

`runtime.json.gz` retains all five reports, compiler sources/private build,
executed positive/mutated bundles, generated sources, dependency inputs and exact
oracle tooling bytes. `capture/receipt.json` covers every new AIR artifact,
including logs, source, SWF and both captures. SDK binaries remain external.

Run from this compiler checkout:

```powershell
node tests/native-generated-storage-reads/verify.cjs
node tests/native-generated-storage-reads/verify.cjs --check-current --check-git
node tests/native-generated-storage-reads/run.mjs
```

The current-input check also needs the original captured cache/input paths. The
archive-only check does not. Set `LAYA_ENGINE_REPOSITORY` and
`OP2_EVIDENCE_REPOSITORY` to override the default adjacent isolated engine and OP2
checkouts. The primary runner verifies OP2's retained 34-row original oracle;
that historical verifier prints its old emission hold before the new results.
It builds a fresh compiler snapshot, so a stale `lib/` cannot produce a pass.

Recreate the AIR evidence in a new output directory using the pinned engine's
`scripts/nativeFlashOracle.py`, `--source tests/native-generated-storage-reads/source`,
`--entry FieldReadsProbe` and the local AIR SDK. Do not overwrite retained captures.

`retain.cjs` accepts five report paths: primary, Object conversion/property,
source-unit retry, Array sort, Array accessors. It authenticates the report inputs
before archiving them. Use `verify.cjs --check-index` to check staged AIR bytes.

This qualifies these source operations and the CustomEase fixture. Complete
PromptTextPanel, combined startup factories and real H5/account acceptance remain
open. No global provider pin is promoted by this change.
