# Generated rest method signatures and super calls

Run `node tests/native-generated-rest-signatures/run.cjs` after `npm run tsc`.
Set `LAYA_ENGINE_REPOSITORY` to the isolated common engine checkout if needed.
The default is `../LayaAir-op2-rest-signature-review`.

All three complete, unchanged AIR subjects are emitted through the production
source-module factory. Their 38 observations match the authenticated original
packet on ES5 and ES2015 in Node and CSP Chromium, with zero strict type errors.
The observer only invokes emitted methods and reports their state.

Coverage includes fixed/rest arity, virtual overrides, different optional
defaults, rest-only methods, fresh tail arrays, preserved element identity,
direct super calls, and two-argument super.apply with its bound lexical receiver.
The fixed prefix of rest methods converts right to left, including throwing
conversions. Rest presence is part of the selected-parent signature; fixed
parameter count remains separate and existing fixed signatures retain their
representation. Signature metadata does not perform argument conversion.

Five compiler guards cover rest/type/return/required-count mismatches and missing
fixed super arguments. Four applied compiler controls restore the former rest
signature omission, super-rest rejection, super.apply omission and forward
conversion order. The last control executes the generated mutant and fails the
two coercion-order observations. Common registrar guards are in the engine's
`tests/nativeGeneratedClass/rest-methods.cjs`.

Adjacent checks pass: native-reference signatures (37 rows), fixed method
overrides (10), optional super calls (13), and optional/rest callables (56).
General super method extraction, non-rest super.apply, other apply arities,
method arguments and full ParagraphElement/OP2 runtime remain separate work.
