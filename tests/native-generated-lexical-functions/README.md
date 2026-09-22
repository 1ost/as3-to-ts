# Generated lexical Function fields

Run `npm run test:native-generated-lexical-functions`. All three complete source
classes from the engine's authenticated `lexical-function-intrinsics` AIR packet
are emitted without edits. The separate observer compares all 38 rows in Node
and Chromium for ES5/ES2015, both with and without reference/numeric entry passes.
Strict provider/output types, seven compiler rejection guards, nine source-global
and loader/domain checks, and five altered comparisons are also required.

Declaration planning accepts an explicit `scriptGlobalProviderModule`, with an
optional `scriptGlobalSources` class selection. Each selected class publishes its
actual native Class binding and authenticated source hash into its own common
script unit inside the lazy class factory. A new domain module instance owns a
new script domain; imported class modules remain lazy. Caller globals belong to
method-defining files, independently of instance ancestry and callback creation.

Bare private/protected Function calls pass that caller global and retain lookup
before argument evaluation. Qualified calls read after arguments and use the
explicit receiver. Direct lexical Function `call`/`apply` reads the Function,
evaluates arguments once, then invokes the common property/intrinsic provider.
Thus null receiver errors occur after argument effects, and a callback field
replaced during those effects does not replace the already read Function.

Static initializers with script-global publication remain rejected until retry
identity is qualified. Wildcard field calls, detached intrinsic reads, arbitrary
global reflection and full Error message/brand parity are not claimed. This
fixture does not prove whole Signal runtime, SlotList.NIL, or accessor locals.
Its observer uses a registered builtin creation global for callbacks; generated
caller globals must be distinct, source-bound units, never that builtin global.
