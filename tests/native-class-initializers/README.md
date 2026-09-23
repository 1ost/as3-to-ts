# Native class initialization

The parser now represents ordinary class-body statements as `CLASS_INITIALIZER`
nodes. In particular, the maintained TweenMax `TweenPlugin.activate([... , {}])`
call is a statement with an array argument, not a list of declaration modifiers
or metadata. Without the explicit emission contract below, class-body statements
fail with `AS3_CLASS_INITIALIZER_UNSUPPORTED`.

## Emission contract

Pass `nativeClassInitialization: {classes: {...}}` in the common emitter options.
Keys are exact source qualified names; every source class being emitted must be
listed as `lazy`. A `ready` entry denotes an externally initialized native
provider constructor. This configuration is a caller assertion, not evidence
that an application dependency or provider is ready.

The generated export is a typed binding created by `declareNativeClass` from
`utils/nativeClass.ts`. Its factory contains the complete original native class,
including the existing `classBound`/`bound` decorators, constructor, methods,
instance fields and accessors. It resolves the base first, allocates static slot
defaults, establishes the final decorated constructor identity, evaluates all
explicit static field initializers in source order, then executes class-body
statements in their original relative order. It returns the decorated class.
There is no eager source initialization during module loading, synthetic static
sentinel field, TypeScript static block, or replacement of the class body with a
stub. The mechanism compiles with the repository's TypeScript 2.4 to ES5 and ES2015.

Every proven source read of a lazy class is lowered through `readNativeClass`.
The result is the actual decorated constructor, not the exported binding handle.
Own-class references use the final constructor captured by the factory; the
prototype's constructor property also identifies that final constructor. A
successful factory publishes once. Failed initialization preserves the thrown
object and permits a fresh class allocation on the next access, as observed in
Flash. Cross-class recursive value reads see null before publication; recursive
class property reads produce TypeError #1009. Recursion in construction, casts,
type tests and mutations explicitly fails as unsupported pending source evidence.

All source modules in a participating closure must use the same exact identity
contract. External package/bootstrap/metadata consumers must resolve a binding at
the correct source access point; they must not register the handle as an authored
Class value or eagerly resolve all handles. Direct property access, invocation or
construction of a handle throws. Other JavaScript introspection of a handle is
outside the authored API. This helper is not a name registry, ABC executor or
general Flash class runtime.

Namespaces, include/embed directives, qualified class-value syntax, direct or
grouped indexed lazy-class receivers (including computed keys and mutations), unproven
class identities, lazy-class `as`, and class-initializer lexical declarations,
`this`, `super` or `arguments` are rejected. Nested function scopes keep their
ordinary semantics. Existing runtime cast checking and typed coercion boundaries
are not expanded: the cast ordering cases use null, and the type-test cases use
ordinary instances. This work does not claim arbitrary Number/String/reference
initializer coercion, reflection, static-const enforcement or instance defaults.

## Actual Flash evidence

`oracle/receipt.json` authenticates retained original AS3, capture programs,
capture output, available command/provenance files and original SWF hashes.
`verify-oracle.js` authenticates the receipt and every retained file; the tests
run it before using observations. SWF binaries remain in the ignored independent
oracle workspace. `RetainOracleEvidence.js <op2-root>` is the explicit retention
entrypoint; changing evidence requires reviewing and updating the verifier hash.
The Flash captures used Flex 4.16.1 and the local original Flash player, with
separate capture profiles and loopback ports, and do not use game account data.

Four independent captures cover:

- `InitOracle.as`: base-first initialization, static fields before body statements,
  body order, lazy class-value access and initialization once. The exact first
  eight rows through `after-class-value` are compared. The complete 15-row capture
  is retained, but its derived **instance** field ordering is a pre-existing
  separate compiler gap: AS3 runs those effects before the base constructor,
  while current native output runs them after `super()`. Constructor-body
  preservation and no repeated static initialization are checked separately.
- `publication/`: 11 exact rows for self references, unpublished cyclic class
  values, final class identity, exception identity and fresh retries.
- `class-reads/`: 11 exact rows for cast, `is`, and construction evaluation order,
  plus the actual instance `constructor` identity. Tests use real shared decorators.
- `cycles-errors/`: 17 exact rows for cyclic field-read error #1009 and repeated
  failed initialization, including preservation of a user-thrown sentinel.

The executable suites run both targets against generated original class bodies.
Strict consumer tests also prove the exported class-value/instance-type surface,
inheritance and method access using the actual TypeScript 2.4 checker.

## Maintained TweenMax boundary

`MaintainedTweenMaxTests.js <op2-root>` authenticates the unchanged maintained
TweenMax source, emits its complete class, checks all 44 constructor/method/
accessor nodes, and verifies its activation statement retains all 19 plugin class
arguments and the original final object exactly once, after static initializers.
Both target outputs pass TypeScript syntax checking. Four external Flash
constructor identities are marked `ready` solely for this structural probe.
The full TweenLite/plugin/Flash-provider runtime closure has not been admitted or
executed by this test. Its output explicitly reports `runtimeAdmission: false`.

## Checks

Run `npm run tsc`, then:

```
node tests/native-class-initializers/NativeClassInitializersTests.js
node tests/native-class-initializers/TypeSurfaceTests.js
node tests/native-class-initializers/MaintainedTweenMaxTests.js ../op2-html5
```

The existing logical-assignment, integer-assignment, native-constructor and
native-namespace suites must remain green. On integration, preserve raw evidence
bytes with `tests/native-class-initializers/oracle/** -text` and preserve the
retention script bytes with
`tests/native-class-initializers/RetainOracleEvidence.js text eol=lf` in
`.gitattributes`; the hashes intentionally cover exact bytes, including EOL.
