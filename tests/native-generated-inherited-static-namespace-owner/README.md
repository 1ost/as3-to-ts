# Inherited static namespace declaring owner

Generated unqualified opened-namespace references to inherited static traits now use the declaring source constructor. Exact declaration identity supplies an explicit collision-safe import, including an ancestor not imported by the source. Existing lazy class reads preserve initialization. Own statics, instance members and ordinary namespace emission keep their existing routes.

AIR authority: engine `5fec36ff4`, `tests/nativeFlashOracle/inherited-static-namespace-owner`. Five snapshots cover static/instance reads and writes, a static method and a static accessor across three classes in different packages. Before the fix both targets had nine generated type errors and rejected the accessor receiver.

Validation: `npm run tsc`; `node tests/native-generated-inherited-static-namespace-owner/run.cjs`; existing `native-generated-static-namespace-namesake/run.cjs`. Set `LAYA_ENGINE_REPOSITORY` and `PLAYWRIGHT_MODULE` to the engine and browser tools. ES5/ES2015 match AIR in Node and Chromium CSP with zero errors, including an alias collision variant. Missing owner modules and copied plans are rejected. A derived-owner substitution restores the accessor failure in both realms. The static namespace regression passes five rows, nine guards and its mutation.

`node tests/native-generated-inherited-static-namespace-owner/verify.cjs` checks the portable packet; `--check-current` also hashes current inputs. The retained pre-fix report corroborates the failure; the packet includes the pre-fix emitter from Git, but does not claim a self-contained rerun of every pre-fix input. Full client runtime, non-generated inheritance, inherited compound assignments and explicit namespace syntax are outside this focused qualification.
