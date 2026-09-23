# Bounded typed-local lowering

Enable `nativeTypedLocals: true` alongside the existing authenticated Class,
lexical-member, coercion, String and Array providers. Supply the common
`nativeTypedLocalAdditionModule` (AS3Addition). This opt-in changes only supported
function-local storage; it does not admit typed ordinary method parameters or
returns, foreign references, inheritance, accessors or source closures.

The compiler resolves Number/int/uint/Boolean/String/Object/Array annotations
from original AS3 declarations before TypeScript remapping. Entry defaults occur
once; initializer effects remain at their original positions. Initializers and
writes use common coercion. Assignment expressions return raw RHS values;
compound expressions capture the old value before evaluating RHS, compute the
raw result, then coerce storage. Numeric updates preserve the original int/uint
prefix distinction. Array uses captured builtin identity. Enumeration,
destructuring, typed constants, conflicting declarations, same-name parameter
redeclarations and catch-shadow writes remain whole-source holds. The existing
member/local declaration-order guard is unchanged.

`evidence` and `repeat-evidence` contain two complete 47-row original captures,
including complete Class/instance describeType XML and exact source/SWF/tool
receipts. The generated class is always compiled whole. The tests cover entry
defaults, skipped branches/loops, repeat declarations, before-declaration writes,
constructors, typed Object receivers and field shadows, all arithmetic/bitwise
compound operators, assignment chains, coercion side effects/errors, and wrapping.

Five methods accept a fixture-only inspector object. Its `read(error,key)`
method extracts only error name/errorID outside the compiled class, in both
original and native fixtures. Compiled methods still perform catching, local
state reads, return construction and every coercion/store operation. Direct
source property reads from common host Error objects are an uncovered property
representation prerequisite. The preceding complete 42-row direct-error fixture
and its five failed native rows are preserved in the delivery review evidence;
they are not claimed to pass. Direct unqualified callback calls remain held.

The older 48-row original typed-local research remains original-only evidence;
closure-mediated local mutation and catch-closure behavior are not admitted by
this fixture. No timing class, complete game module or logged-in game readiness
is claimed.

Run after building the compiler, with `LAYA_ENGINE_REPOSITORY`,
`PLAYWRIGHT_MODULE` and `PYTHON` set:

```
npm run test:native-typed-locals
```

The runner authenticates the pinned original manifest and committed engine
dependency, then checks actual provider declarations and generated consumers.
It compares all47 rows in Node and Chromium for ES5 and ES2015. Original
inspector/hook functions are test instrumentation, never emitted class bodies.


## Committed-engine integration replay

The integrated runner archives the exact engine commit in addition-dependency.json
and authenticates the two committed addition/coercion source blobs. It does not
copy candidate overlays or require LAYA_ADDITION_PROVIDER. The earlier handoff
hash and raw candidate hashes remain historical provenance; committedProductionFiles
records the actual archived bytes after Git code-line-ending normalization.
The complete source captures and comparisons remain unchanged. Reports record
the committed engine revision and source mode actually executed.

Git archive can apply repository CRLF attributes to engine code. The verifier
accepts only CRLF-to-LF normalization against exact committed blob hashes and
records affected paths. Original source-capture bytes are never normalized.
