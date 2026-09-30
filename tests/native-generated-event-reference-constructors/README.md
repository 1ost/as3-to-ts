# Generated Event and MouseEvent constructor references

Native Event and MouseEvent constructor parameters now use reference authority
from the existing authenticated native-base bindings. A provider name alone is
insufficient. This uses the already qualified common event identity and generated
subclass allocation; it introduces no new event runtime or broad native-type
fallback. The compiler previously rejected even Event constructor parameters.

All five complete original consumer/subclass sources are compiled unchanged.
ES5 and ES2015 each match all 65 original AIR observations in initialized Laya
under CSP Chromium. The cases distinguish Event/subtype acceptance, mismatches,
omission/defaults, argument counts, conversion hooks and ordering before body
effects. Eight compiler guards reject missing reference/native-base authority,
wrong exports, copied plans and non-null defaults. Twelve runtime guards reject
forged/proxied/copied events before constructor body entry. Type diagnostics and
browser errors must be empty.

```powershell
node node_modules/typescript/bin/tsc
node tests/native-generated-event-reference-constructors/run.cjs
node tests/native-generated-event-reference-constructors/verify.cjs
```

The engine retains original evidence under
`tests/nativeFlashOracle/generated-event-reference-constructors`. The real
FlowElementMouseEvent caller remains part of the full startup audit; this fixture
does not replace its FlowElement dependency or claim complete TLF execution.
