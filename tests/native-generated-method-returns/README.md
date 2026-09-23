# Generated typed method returns

Run npm run test:native-generated-method-returns against the isolated common
Laya engine. Its generated-method-returns packet authenticates two identical AIR
captures with 34 observations and three complete, unchanged source classes.
Both ES5/ES2015 outputs execute in Node/Chromium, standalone and combined with
the reference/numeric parameter passes. Strict actual-provider type checking,
eight rejection guards and four negative comparison controls are included.

The generated method body inserts common AS3Property return conversion at each
original return expression. Nested compiler-created functions keep their own
returns, typed-local lowering retains assignment results, and thrown values never
pass through return conversion. Exact source declarations select intrinsic and
source-reference types. Array uses the captured native Array; reference types use
the immutable declaration domain. There is no wrapper around whole method execution.

The packet covers Number/int/uint/Boolean/String/Object/Array/Function and planned
source-reference results, null/undefined, conversion hooks and failure, exact/child
identity, rejection, void completion, branching, static methods and consumed typed
local compound assignment. The AIR child has an explicit super constructor; its
implicit-constructor baseline remains preserved in the engine history.

Typed try/catch/finally regions and fallthrough remain held; the retained 22 AIR
return observations in native-method-signatures demonstrate why JavaScript return
wrappers are insufficient. Native reference return types (including Event),
optional/rest methods, vectors and unresolved types also remain held. This does
not qualify implicit derived constructors or whole-game method metadata behavior.
