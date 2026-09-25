# Generated methods with a selected parent

Run `npm run tsc`, then `node tests/native-generated-method-overrides/run.cjs`.
The complete Base, Child and Grandchild subjects come from the shared engine's
authenticated `generated-method-overrides` AIR packet. Only the observer is a
native host adapter. Explicit source constructors keep constructor synthesis
outside this override test; no subject body is patched after capture.

The production native module factory emits a parent module and a child module
containing all three declarations. The child must reuse the selected parent
Class and its registered layout/signatures. Supported public method contracts
contain fixed required intrinsic parameter types, return type and override/final
modifiers. The engine verifies these against the actual selected parent before
publishing the child. Source reference signatures are now qualified separately
by `native-generated-reference-overrides`. Accessor, optional/rest/native-reference and namespace override
extensions remain held. Ordinary methods without such a contract remain usable
through their existing providers, but cannot grant selected override authority.

`run-ny3NCc`: ten AIR observations match on ES5/ES2015 in Node and Chromium,
with zero type diagnostics, five identity/lifetime checks, eight compiler
rejection cases and two applied implementation mutations per target. Mutated
bundles must build successfully before their specific runtime failure is tested.
Browser CSP forbids runtime compilation. Source/compiled output and transitive
provider/type inputs are hashed and checked at the end.

Regression runs: inherited classes production factory `run-n1wKPg` (47 AIR
observations, 15 runtime checks, eight factory guards, three mutations, no type
errors) and loaded interfaces `run-HLZ26p` (61 AIR observations, five checks,
four compiler guards, two mutations, no type errors). Both cover ES5/ES2015 in
Node/Chromium. This does not claim OP2 startup or full client qualification.
