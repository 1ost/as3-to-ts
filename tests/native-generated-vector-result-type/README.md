# Source-authenticated Vector expression result types

Run `node tests/native-generated-vector-result-type/run.cjs` with `LAYA_ENGINE_REPOSITORY` and `PLAYWRIGHT_MODULE` set. Verify the retained packet with `node tests/native-generated-vector-result-type/verify.cjs`; add `--check-current` to compare live inputs.

At c6f6f08, generated construction and conversion expressions inferred `AS3Vector<unknown>` from deliberately erased declaration tokens. Four typed field assignments failed TypeScript; an own-class comma read also produced TS2695. The unchanged source probe matched AIR at runtime despite these five errors in both compiler targets. That baseline report and emitter source are retained separately from fixed inputs.

The emitter now projects the exact authenticated specialization through the existing Vector annotation emitter and explicitly discards an own-class read with `void`. It preserves runtime declaration identity, class initialization, argument order, element coercion and conversion identity. No runtime Vector API changes or relaxed declaration checks are used.

The AIR fixture `engine/tests/nativeFlashOracle/vector-result-type` supplies two identical captures and 13 rows, compared with ES5/ES2015 output in Node and Chromium under CSP. It covers typed fields, allocation defaults/fixed length, ordered arguments, subclass and object identity, conversions, return values, own-class construction and a file-local helper. A rejected foreign push raises 1034 and still increases length, as AIR does.

Three guards reject copied plans, changed source and a shadowed element class. Applied controls remove result projections (four TS2322 errors), remove own-read `void` (TS2695), and substitute a foreign declaration token (runtime specialization mismatch in both realms). Adjacent file-private Vector tests pass 11 rows and static-storage tests pass 28 rows in both targets/realms with zero type errors. This focused qualification does not prove whole-client H5 acceptance.
