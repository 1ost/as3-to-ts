# Authenticated StyleSheet bridge

`style-sheet-provider.test.cjs` uses the unchanged five-case AIR fixture retained in LayaAir's `tests/nativeFlashOracle/style-sheet-shared-profile`. It validates receipt and source hashes, produces SDK-derived class/member and canonical engine type authority, emits through the hardened frontend, and executes the generated application entry in Node and Chromium. The fixture covers construction, native inheritance and class identity, CSS parsing, field attachment/readback, style copy/transform/clear, and detachment. No original AP source is transformed.

The exact behavior selector admits the shared StyleSheet data API and the canonical TextField.styleSheet property; it rejects changed source types, arities, target identities and member scopes. `style-sheet-mapping.test.cjs` exercises those boundaries independently. The engine's separate 81 data/25 field cases and eight native-verified paint/layout controls provide wider provider evidence.

Set HARDENED_FIXTURE_LAYA, HARDENED_FIXTURE_AIR_SDK, HARDENED_FIXTURE_FFDEC and LAYA_PLAYWRIGHT_MODULE, build the compiler, then run both tests with `node --test`. Mouse-driven stylesheet link states remain a fidelity gap; admitting the source API does not establish complete stylesheet behavior or authorize an original-client release.
