# Optional selected-parent overrides

Run `npm run tsc`, then `node tests/native-generated-optional-overrides/run.cjs`.
Complete Base, Child and Grandchild sources come from the shared engine's
authenticated `optional-method-overrides` packet. Only the observer adapts the
host; subject bodies are unchanged.

AIR allows different literal defaults in overrides but rejects a changed count
of required parameters. The compiler emits that count with the exact nominal
parameter/return signature. The engine compares it with the selected parent's
registered signature. Defaults remain owned by each method implementation.
Rest, accessor, native-reference and namespace override extensions remain held.

`run-YLA6Up` matches eleven AIR rows on ES5/ES2015 in Node and Chromium under
CSP, with zero type diagnostics, five domain/lifetime checks, eight compiler
rejection cases and four applied mutations per target. Mutations remove method
signatures or parent selection, change the required count, or exceed the declared
parameter count. Every mutated bundle builds before its specific rejection is
checked. Factory output is deterministic and transitive inputs are hashed.

Cases cover dynamic override defaults, partial calls, explicit undefined,
parent-owned defaults in super calls, nullable references, bound method identity
and declared length, transitive overrides, and too many/few arguments. This is
compiler/provider qualification, not proof of OP2 startup or account flows.

Regressions: fixed overrides `run-5oIMdb` (ten AIR rows), source reference
overrides `run-aqUlH8` (ten rows), and optional super calls `run-jJ8I1u` (thirteen
rows) pass both targets/runtimes with zero type diagnostics. The last fixture now
accepts the equivalent earlier trait-projection rejection of a required parameter
following an optional one.
