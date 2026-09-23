# Logical assignment and cast-member syntax

From the compiler root:

```powershell
npm run tsc
node tests/native-assignments/NativeAssignmentsTests.js
node tests/native-assignments/FlashAssignmentRegressionTests.js
node tests/native-assignments/MaintainedSourcesSyntaxTests.js <OP2-checkout>
```

The scanner/parser now retain `||=` and `&&=` as assignment operators, rather
than parsing a logical operator followed by an identifier named `=`. The emitter
lowers the AS3 operation as assignment of a short-circuit result: the RHS may be
skipped, but assignment and setter invocation always occur. The original native
test incorrectly assumed modern JS logical-assignment behavior; an independent
Flash capture exposed that error. Identifiers retain their lexical binding.
Proven ordinary dot references capture their receiver once in a fresh
function-local variable, before the getter/RHS/setter sequence. Generated names
cannot shadow source names. Receiver capture uses no IIFE, preserving source
`this`, `arguments`, exceptions and assignment-expression results. Coercion wraps
the complete selected result, including the branch that skips the RHS. The
bounded types are wildcard/untyped (identity), int/uint (existing integer
conversion), Boolean (truth conversion), and Object (undefined becomes null).

Computed-key references, namespace selectors, `super` references, and receiver
capture without an emitted function body reject explicitly. Their additional
key-coercion, namespace or allocation requirements are not inferred from ordinary
dot syntax. Number, String, and other reference destinations reject until their
conversion providers are bound. Dot-member destination types must come from an
unambiguous own writable field/setter of a same-package, same-file ordinary
class; a declared local/parameter or own method return type must prove the
receiver. Unknown receiver types, inherited/dynamic receivers, inaccessible
traits, and method/readonly targets reject. This change does not admit generic
Flash Proxy/property providers or silently treat unproven typed fields as '*'.

Type assertions emitted for source casts are enclosed in parentheses. Thus the
maintained `Object(param2).allowCodeImport = true` retains a member-expression
lvalue: `(<any>(param2)).allowCodeImport = true`. The grouping also preserves the
receiver of following method calls and compound assignments. It does not add
runtime class checking or implement missing Object/primitive conversion behavior;
the executable cast cases use already-object non-null receivers, matching the
reviewed maintained source path.

The native fixture executes the actual compiler decorators and ES5/ES2015 output.
Its 230 checks cover falsy/truthy values, unconditional writes, getter/setter and RHS
effects, receiver reassignment during RHS, nested assignments, exceptions at each
stage, original `arguments`, generated-name collisions, selected-result coercion,
and cast-member setter/compound/call behavior.
Paired implicit/explicit accessor cases resolve the setter parameter type from
the same AST trait authority, including static accessors. Missing accessor scope
metadata cannot become wildcard authority. Readonly/write-only and unsupported
Number/String accessor cases reject for both spellings.

`FlashAssignmentRegressionTests.js` adds 348 comparisons across the two targets
against retained independent actual Flash observations: ten getter/setter traces,
the int/uint selected-result case, the Boolean projection, and all 162 Object
cases (nine initial values by nine RHS values by two operators). The full
captured Number/String row is retained even though those destinations reject
pending conversion authority. The Object corpus checks primitive/reference
identity and proves selected RHS undefined becomes null. An initial undefined
already becomes null when assigned to the oracle's Object local; the native
projection supplies that initial typed-value precondition explicitly. It does
not claim general variable/parameter initialization coercion.

The `oracle` directory contains the original AS3 and raw Flash JSON plus capture
scripts and receipt. Expected values are never computed from native code. The
runner authenticates the receipt and all retained input hashes before executing
the actual shared compiler and its decorators. Object-capture provenance records
exact compile/capture commands and source/tool/SWF/output hashes. The earlier
getter capture did not retain a command transcript; its source, SWF identity,
capture script and observations are hash recorded without inventing that
history. This is retained actual Flash comparison, not a new live Flash run or
complete startup admission.

Reproduce receipt extraction from the original ignored reviewer artifacts with
`node tests/native-assignments/RetainFlashAssignments.js <OP2-checkout>`.
Receipt SHA-256 is
`22ef06a8313ed681467abdf9d06545af5b4c5cdcfe9276ee54bc2cb2621a9452`.
For fresh Windows checkouts preserve the original mixed byte conventions with
the exact Git attribute `tests/native-assignments/oracle/* -text`. Also keep
`tests/native-assignments/RetainFlashAssignments.js text eol=lf`, since its raw
hash is part of the receipt. These attributes are integration-owned; this
workpack does not edit `.gitattributes`.

The source integration test authenticates the unchanged complete LiquidData and
SWFResourceParser AS3 files with their recorded SHA-256 hashes, then checks emitted
TypeScript syntax and ES5/ES2015 transpilation diagnostics. It writes no source
and substitutes no class bodies. Their external dependencies and application
runtime behavior remain separate obligations.
