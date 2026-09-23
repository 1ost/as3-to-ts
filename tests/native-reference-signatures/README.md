# Reference method entry and return lowering

Run `npm run build` then `npm run test:native-reference-signatures` with the
isolated `../LayaAir-op2` providers installed. The test authenticates that
checkout's `reference-signatures` AIR packet, emits the entire unchanged probe,
checks TypeScript diagnostics, and compares all 29 observations in Node and
Chromium using both ES5 and ES2015 output. Twenty-two guards check unsupported
signature and arguments shapes. Reports retain source/output and bundle-input
hashes in `.cache/native-reference-signatures`.

For ordinary consumer methods with planned reference parameters or returns,
the emitter uses common AS3Type argument-count/reference coercion and explicit
AS3Coercion numeric providers. Entry checks precede conversions; mixed reference
and numeric parameters convert in source order. Reference optional defaults are
limited to literal null. Return coercion stays inside the return expression so
source catch/finally behavior is preserved. Source declaration tokens continue
to control nominal checks, rather than TypeScript assertions or host prototypes.

Using arguments admits extra arguments. Strict module output updates supplied
arguments entries after coercion; omitted optional entries remain absent and
subsequent parameter writes do not alias the entries. This currently admits
integer-literal indexed reads, length reads and simple writes to required
entries. Escaping arguments, methods, dynamic indexing, length changes and
writes that could grow its length remain held: host arguments is not a general
replacement for the source Array. Modules are checked on both output targets.

Constructors, accessors, rest parameters, nested functions, unqualified mixed
parameter types, arbitrary
defaults and bare reference returns remain held. Generated class signature
lowering remains independently owned by the generated-class path. This fixture
does not qualify a complete application class or real game flow.

Mixed scalar/Array returns and String parameters are separately qualified in
`../native-mixed-reference-signatures` with an explicit common property provider.
