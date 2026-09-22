# Generated source-class typed locals

Run `npm run test:native-generated-class-locals` after `npm run tsc`, with
`PYTHON` set to the physical Python used by the retained evidence verifier.
The default engine is `../LayaAir-op2`; `LAYA_ENGINE_REPOSITORY` overrides it.

This uses all 12 unchanged classes from `native-foreign-typed-locals/capture-c`.
That historical packet is **Pepper Flash**, not AIR. The new packet in `evidence`
was captured twice through AIR ADL 51.3.4 (Desktop WIN 51,3,4,2). The oracle host
is adapted from the old ExternalInterface host to expose `snapshot()`; no source
class body is rewritten. Both complete Class/instance reflection arrays are
retained as evidence, but generated reflection is not compared here.

The 41 value/storage rows, seven initialization rows and nine error rows run in
Node and Chromium for ES5 and ES2015 output. Baseline and combined reference/
numeric-signature passes must both agree. The observer also checks ten domain
identity/loading invariants; 13 rejection guards and five altered comparisons
exercise the admission boundary. Generated files typecheck against real common
providers. The twelve source subjects use the compiler's TypeScript version;
support helpers use the engine's current TypeScript to parse their modern syntax.

Error message **text** remains unqualified. Pepper release reports `Error #1034`,
while debug AIR includes a colon, descriptive text and unstable object addresses.
The new host and matching observer explicitly compare message type/null storage,
name, errorID, freshness, mutation, fixed slots and rethrow identity. Historical
raw messages remain intact in the older packet. Do not describe this comparison
as full diagnostic-text parity. The verifier compares the new observations to
the historical rows with that specific field projection.

Generated locals use authenticated declaration tokens without reading a lazy
Class value. Self references, qualified namesakes, constructor locals, repeated
declarations, cyclic reference-only dependencies, raw chained assignment results,
failed writes and deferred initialization are covered. Erased, unused source
imports are removed to avoid duplicate TypeScript names for qualified namesakes.
Reference signature lowering leaves local storage to NativeTypedLocals while
retaining parameter conflict checks.

Source-local constants, incompatible redeclarations, parameter/catch conflicts,
reference compound/update operations, typed for-each header declarations and
typed nested parameters remain held. Signal optional/rest callables and
SlotList.NIL initialization are separate prerequisites. This is not whole-client
or Signal runtime admission.

Capture command (from the compiler checkout, fresh output required):

```powershell
python ../LayaAir-op2/scripts/nativeFlashOracle.py --air-sdk <AIRSDK_51.3.4> --source tests/native-generated-class-locals/source --entry GeneratedClassLocalProbe --output <fresh-directory>
```

`verify.cjs` authenticates the receipt, every artifact and current source bytes,
unchanged historical subjects, repeated native results and runtime identity.
The historical verifier separately authenticates the original Pepper packet.
