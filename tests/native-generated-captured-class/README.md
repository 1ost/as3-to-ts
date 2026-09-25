# Generated captured Class callbacks

Run npm run test:native-generated-captured-class after npm run tsc.
The engine path defaults to ../LayaAir-op2 (LAYA_ENGINE_REPOSITORY overrides it).

The runner authenticates the retained captured-class-callback packet, emits all
three complete original classes, and compares all 22 repeated AIR observations.
Both ES5 and ES2015 run in Node and Chromium, alone and with the reference and
signature passes enabled. Strict generated/provider checking has zero diagnostics.
Twenty compiler rejection guards and three intentionally altered comparisons
check that unsupported scopes and mismatched observations do not pass.

Selected script globals now surround the complete lazy Class factory. The
generated declaration helper accepts a factory receiving its defining global,
and returns the Class exported by the successfully initialized script unit.
Classes and declaration modules must be regenerated together.

Fifty additional native lifecycle checks run for each target in both runtimes:
the global exists before registration; failed provider calls invalidate it;
retry after an injected provider failure retains final Class/global identity;
successful initialization is cached; separate cohorts remain distinct; and
duplicate publication or unload cannot run or publish a new Class factory.
The original three AS3 subjects and 22 AIR rows are unchanged. These injected
provider failures do not qualify source static-initializer retry semantics.
Static initializers remain held for script-global classes. ApplicationDomain
emission and loader association are still separate pending work.

The compiler uses the common AS3Class provider for null defaults, Class entry and
local coercion, raw consumed assignment results, and captured construction. It
registers generated constructors with their exact source arity. Argument coercion
already runs in the emitted constructor before instance fields; registration keeps
that existing prefix rather than running conversions twice.

Anonymous wildcard callbacks retain an ordinary function receiver and captured
function storage. Their creation registers the authored source script global and
formal parameter count with AS3Invocation. Plans must explicitly bind the script
global provider and source; importModules must bind compiler.AS3Invocation, and
nativeObjectCreationModule binds the common AS3Class provider.

The observer is separate host adaptation, not another ported source class. Direct
observer calls use the common builtin global; observer-global reflection is not
compared. Function.call uses the common property/invocation providers. The JSON
row qualifies the original callback with these values, not general JSON parity.

Typed/default/rest anonymous parameters, typed returns, nested functions/catches,
arguments lookup, receiver property access, and callback locals shadowing outer
storage remain held. Class parameter writes, Class fields/returns and general
wildcard constructor calls are not qualified. Native Class metadata, native source
subclasses, complete error text and application flows remain outside this packet.
