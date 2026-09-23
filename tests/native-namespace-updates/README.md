# Namespace integer update evidence

The retained AIR 51.3.4 capture contains 96 observations from two identical
executions: `int`/`uint`, prefix/postfix increment/decrement, three boundary
values, explicit namespace fields, opened `this` fields, a receiver method,
and getter/setter pairs. The full source, SWF, host, runtime observations,
frames, logs and tool/source hash receipt are retained byte-for-byte.

Prefix field updates return the unwrapped numeric result and coerce storage.
For example, signed maximum increments to stored `-2147483648` but returns
`2147483648`. This differs from the retained typed-local `int` prefix evidence.
Postfix returns the old value. Receiver methods execute once; accessor captures
record one receiver call, one getter and one setter receiving the coerced value.

Authenticate the retained evidence with:

```powershell
node tests/native-namespace-updates/verify-evidence.cjs
```

To recapture, from this compiler checkout, choose a **new** output directory:

```powershell
& $env:PYTHON ../LayaAir-op2/scripts/nativeFlashOracle.py --air-sdk $env:AIRSDK_HOME --source tests/native-namespace-updates/source --entry NamespaceUpdatesOracle --output .cache/namespace-updates-new-capture
```

The default-package oracle entry explicitly imports the subject because the
current shared host template does not import packaged entries. It only invokes
the subject's complete `snapshot`; it does not replace its update operations.
The receipt identifies the exact runner and SDK inputs used for this capture.

`npm run test:native-namespace-updates` compiles the complete captured subject
through the normal two-pass emitter, loads the distributed method decorators,
and compares all 96 observations on ES5 and ES2015. A supplementary punctuation
variant checks parenthesized update references against the same values; it is
not an additional Flash capture. Thirteen negative controls retain unsupported
boundaries, including local/parameter/function shadowing of receiver methods.

The lowering covers own instance int/uint namespace fields and matching
getter/setter pairs with explicit source-resolved receivers. It captures the
receiver and old value once, coerces the store, and preserves prefix/postfix
expression results. Prefix AST ranges now include the operator so source
catch-up cannot emit a second update outside the generated expression.

Generic dynamic updates, inheritance, static slots, implicit receivers,
setter-only/getter-only properties, exceptions, general getter/return coercion
and full OP2 behavior remain outside this checkpoint. AIR is the native
reference here, not Pepper Flash or Ruffle.
