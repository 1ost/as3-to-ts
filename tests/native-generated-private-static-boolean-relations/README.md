# Private static Boolean relational initializers

OP2 InlineGraphicElement's private `isMac:Boolean` initializer compares a
Capabilities string-search result with -1. The compiler previously rejected
this initializer as an unqualified private static primitive expression.

The shared emitter now distinguishes computed comparisons from AIR-folded
literal comparisons. A call operand keeps the Boolean slot's initial false
value and evaluates during class initialization. Two same-kind literal operands
(finite decimal numbers or unescaped strings) publish the folded comparison
before class initialization. Earlier writes to folded slots are preserved.
The change covers `<`, `>`, `<=`, and `>=`. Other initializer forms retain
existing guards; mixed constant types and escaped string constants are held.

Engine oracle commit: `64485f72a5897b30204c0fb41deac5b208ba84d6`.
No engine runtime source changed. This compiler branch starts at
`9d01bb774c0e72125e2860b65c6cc535edc6d882`.

## Validation

- Three unchanged source classes match all ten final AIR observations on ES5
  and ES2015 in Node and Chromium using the real source module loading session.
  The browser serves precompiled bundles with `script-src 'self'`.
- Checks include early reads/writes, numeric/string comparisons, NaN, signed
  zero, chained search, operand order, construction, and retry side effects.
- Six host checks cover isolated identities/state, repeated lookup and retained
  classes after retirement. Fourteen rejection guards preserve unsupported forms.
- Three actual generated-factory mutations per target (wrong folded default,
  premature computed value, inverted comparison) each cause an observed AIR
  mismatch in both runtimes. These are distinct from comparator-only checks.
- Adjacent protected-static suite: ten AIR rows, two targets/runtimes, twelve
  rejection guards and zero type diagnostics. Its older dynamic loader is
  explicitly NOT strict-CSP qualification.
- `npm run tsc` and generated/dependency type checks pass.

Run from the compiler checkout with the pinned engine sibling `../engine`:

```powershell
npm run tsc
node tests/native-generated-private-static-boolean-relations/run.cjs
$env:LAYA_ENGINE_REPOSITORY = 'D:\op2-urlrequest-type-tests-20261004\engine'
$env:OP2_BROWSER_REPOSITORY = 'C:\Users\admin\Desktop\GITHUB REPO\op2-html5\game-client-laya'
node tests/native-generated-protected-static-booleans/run.cjs --combined
node tests/native-generated-private-static-boolean-relations/verify.cjs
```

The hash-pinned `runtime.json.gz` retains 492 input/output files, full generated
factories, executed bundles and mutants, observations, exact compiler inputs,
AIR evidence, and both regression reports. `verify.cjs` checks its internal
provenance without needing historical worktrees; `--check-current` additionally
compares the original absolute paths with the retained bytes. The latter mode
requires the recorded checkouts and run directories.

`baseline-failure` preserves the original failing compiler and expanded AIR
cohort. It is historical reproduction evidence, not a failure capture for the
later final cohort. `evidence-qualified` is the final oracle cohort.

## Original-source replay and remaining work

`replay.cjs` uses the previously authenticated 1,356-source, 95-script input.
The unchanged baseline still rejects the missing Capabilities identity.
Adding Capabilities only in the diagnostic subprocess now passes the private
Boolean initializer and reaches:

```
AS3_NAMESPACE_UNSUPPORTED: open namespace member requires explicit selector: stop
```

The replay does not promote a production Capabilities provider. Its absent
members and version-gate behavior still require qualification. Full source
factory emission, startup integration, and actual H5 game acceptance remain
open. Production checkout pins are unchanged.
