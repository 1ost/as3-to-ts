# Generated maintained MouseEvent helper

The complete retained MouseFactory.as source is emitted as native class factories
in ES5 and ES2015, then loaded into ApplicationDomains in real Laya Chromium.
It contains the byte-preserved maintained TLF PsuedoMouseEvent helper and a
pre-super observation class. Source provenance and two matching AIR captures are
verified by the engine's tests/nativeFlashOracle/generated-mouse-event packet.

Each target matches all 20 original behavioral observations with zero TypeScript
diagnostics or browser errors. Thirteen compiler rejection checks and five
runtime visibility/type/receiver checks pass. Sibling domains have distinct
private identities and retiring a session preserves existing instance accessors.
Five older constructor/clone observations and a native input-coordinate regression
also pass. The two original instance reflection trees are intentionally excluded:
complete generated helper reflection is not qualified here.

The native base requires the explicit AS3GeneratedMouseEventConstruction provider.
Object target/currentTarget overrides are restricted to inherited readonly Event
getters; other MouseEvent native overrides remain held. InteractiveObject parameters
require their canonical reference provider. Number=NaN constructor defaults emit
(0/0), with shadowed NaN and int/uint NaN defaults rejected. Generated declarations
use their authenticated plan rather than the legacy global class-member scanner,
which could attach file-private members to an absent public class record.

Run from the compiler checkout:

```powershell
npm run tsc
node tests/native-generated-mouse-event/generate.cjs --check
node tests/native-generated-mouse-event/run.cjs
node tests/native-generated-mouse-event/verify.cjs
```

The generator reproduces the compiler trait inventory directly from the retained
126-row original MouseEvent-properties packet. runtime.json.gz retains generated
sources, consumed provider graph hashes, compiler input hashes and observations;
runtime-pin.json authenticates its bytes. The verifier checks current compiler
inputs and fixture source against the retained run. This qualifies the isolated
helper, not whole-game startup, full TLF layout or real-account integration.
