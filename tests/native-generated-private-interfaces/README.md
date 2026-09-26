# File-private interface source modules

Run after `npm run build`:

```
node tests/native-source-unit/interfaces.cjs
node tests/native-generated-private-interfaces/run.cjs
node tests/native-generated-private-interfaces/full.cjs
```

The engine's authenticated `file-local-interfaces` packet supplies four complete
AS3 files and 21 repeated Flash observations. Complete native source factories
now reproduce every observation on ES5/ES2015 in Node and CSP Chromium. Each
target checks 26 sibling/inherited-domain and retained-lifetime cases, 12 compiler
guards and zero generated/provider type errors. No handwritten native helper
implements the AS3 fixture.

Private interfaces occupy `plan.privateInterfaces`; `plan.interfaces` remains
the public table. A cached internal view connects their exact identities and
reflected names to callable, reference, trait and lexical type consumers. Selected
interface ASTs retain original source bytes, spans and file-scope imports. Their
TypeScript exports are erased; runtime values are common nominal interface
tokens. Source-file coordinators publish these as private constants alongside
the actual Class factories, without exposing private definitions to public lookup.
Inherited public Classes retain the private tokens captured by their original
source implementations.

Explicit `IValue(value)` uses common reference coercion. Interface construction
and unsupported coercion arity remain rejected. The common script-global provider
validates interface constants and prevents redeclaring owned tokens across units
or domains; ordinary Object aliases do not redeclare interface identities.

The smaller header test retains 19 checks per target, 13 guards and zero type
errors. Five declared members produce 22 implementation contract checks,
including inherited surfaces. The source-unit test checks four interfaces, 77
type references and four authority guards. These narrower tests are distinct
from the full native source replay. Public interfaces extending private interfaces
remain outside admission; complete TLF/Game/UIUtil behavior is not proved here.
