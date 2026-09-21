# Source addition and wildcard storage correction

The initial typed-local candidate handled typed `+=` but left plain source `+`
and wildcard compounds on JavaScript addition. The independent complete
LocalReview fixture proved String-left conversion must call the right operand's
toString hook: original `xs` differed from native `x7`/valueOf.

With `nativeTypedLocals` and its common addition provider, original AS3 ADD
nodes now call `as3Add`. Flat + and - sequences remain left-associative;
operands execute once in source order. This happens before generated callable,
property and local-store scaffolding. It covers methods with or without locals,
constructor bodies and local/instance/static initializers. Generated numeric
update arithmetic remains separate. Helper aliases avoid complete-source names.

Original simple-identifier wildcard `+=` uses authenticated local, parameter or
catch ownership. It reads the old value before RHS evaluation, converts only
after both operands are evaluated, and stores last. No field is inferred from a
matching spelling. A source local with an omitted type annotation is wildcard;
ordinary method parameters still require the existing explicit `:*` annotation.

The repeated complete Placement captures establish an unusual catch distinction:
when a function local or parameter shares a catch name, ordinary catch-body
reads see the caught value, while simple assignment and `+=` write the function
slot. Generated read/write closures capture that slot outside the catch. These
are compiler scaffolding; source closures remain held. Unique catch bindings
write themselves. RHS self-writes and throws, parameter/field shadows, and helper
parameter-name collision are covered. Nested same-name catches, unproved catch
write operators, catch/local redeclarations and catch-shadow fields are held.

The final complete32 fixture was captured twice with full Class/instance XML.
It retains the earlier29 cases and adds implicit local, explicit parameter
annotation and capture-name controls. The earlier complete32 fixture with an
unannotated parameter remains under held-evidence/held-repeat-evidence: both
whole sources reject under the unchanged parameter guard. No method bodies are
selected or substituted. Earlier15/24/29 captures remain in delivery review
evidence. The independent11 fixture is retained separately and unchanged.

Both runtimes and targets use committed engine27aa27de with actual provider
source/declarations. Each runtime suite has four result-comparison negatives.
The source boundary check counts 20 original plain + operations and 15 wildcard
compounds across the two new fixtures; all35 use source-helper calls. The
original47 fixture's seven generated numeric + operations remain separate.
Full original XML is compared semantically while retaining its original bytes.
Ten additional rejection controls preserve unsupported binding boundaries.

The root's separately authenticated emitArray parentheses fix and seven syntax
controls are included. The separate return/comment parser correction is not.
Original47's Error inspector limitation and all source-closure, foreign-type,
ordinary typed-method/accessor and inheritance prerequisites remain. This does
not establish full operator, timing-module or game readiness.

Set LAYA_ENGINE_REPOSITORY, PLAYWRIGHT_MODULE and PYTHON, build, then run:

```
npm run test:native-typed-locals
npm run test:native-addition-expressions
```
