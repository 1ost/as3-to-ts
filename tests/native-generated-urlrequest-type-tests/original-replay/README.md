# Original InlineGraphicElement replay

The complete unchanged 1,356-source / 95-class-script input from OP2 checkpoint
`70945341493d72e8b1b1954a2d0b562e9f3c26c3` was replayed with compiler
`89d3a1b6d3f85683900d330b2d0b82d85bf83d5b` and engine evidence/runtime checkout
`7d0e97587611013bea23e8a7bf36e377763f18a7`. The explicit URLRequest provider clears
the type-test hold. Emission now stops at line 54:

```
private static var isMac:Boolean = Capabilities.os.search("Mac OS") > -1;
```

The exact failure is `AS3_CLASS_INITIALIZER_UNSUPPORTED: unresolved class-value identity: Capabilities`.
Next establish the shared Capabilities provider and qualify the static initializer
path before replaying this declaration. Complete emission is not claimed.

`report.json.gz` preserves all original sources, provider options, source/compiler
hashes and the failure. `helpers.json.gz` preserves exact helper checkout bytes;
the verifier separately authenticates their normal Git EOL/filter mapping against
the pinned tree. `verify.cjs --check-current` authenticates the original baseline,
unchanged source cohort, retained compiler proof and helper bytes, then checks
current inputs. Factory, whole-client type checking,
runtime startup and account acceptance were not run.

`run.cjs` retains the exact tool used at
`D:/op2-urlrequest-type-tests-20261004/replay/run.cjs`; it uses that workspace's
sibling compiler/engine and refuses to overwrite its report. The existing OP2
checkout on C: remains at `709453414` because that volume is full. Promote this
verified checkpoint into its port notes when writable space is available.
