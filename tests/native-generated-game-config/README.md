# GameConfig constants in native script domains

Run `npm run tsc`, then `node tests/native-generated-game-config/run.cjs`.
The test authenticates the complete maintained OP2 GameConfig against
`../op2-html5/game-client-laya/tests/game-config-generated/verify.cjs`.
No subject fields, methods or constructor are replaced or removed.

Public static primitive constants use the already qualified early storage
lowering, including numeric literal products and resolved own uint OR constants.
Flat Array literals can initialize public static Array constants when each item
is a primitive literal or an unqualified reference to one of the same class's
immutable early primitive constants. Those arrays use the existing deferred
constant initializer and are allocated separately for each actual script domain.
Their bindings remain readonly while their contents remain mutable.

This admission has no authored callbacks, getters, mutable-field reads or external
Class dependencies that could fail/reenter during evaluation. Static variables,
calls, array aliases, nested arrays, qualified member reads, arbitrary computed
expressions, nonpublic constants and class-body effects remain held. This does
not establish general failing initializer/script-global retry identity.

`run-zE205X` matches all **1,391 AIR observations**, covering all 1,378 constants
and the four arrays' identity/mutation/readonly behavior, on ES5/ES2015 in Node
and Chromium under CSP without runtime compilation. Nine domain/lifetime checks,
fourteen compiler rejection cases, one applied wrong-constant mutation and zero
type diagnostics pass. The mutation changes generated MAX_WIDTH from 1440 to
1441 and must produce different runtime observations; build failure is not a pass.
The complete CacheName regression `run-1NuxhM` also passes its AIR row, 189 source
constant comparisons, six runtime checks, seven compiler guards and zero types.

The native observer copies arrays for snapshots and restores its temporary append
by resetting length. These are observation-host operations; GameConfig itself
does not invoke concat/pop, whose dynamic source methods are not qualified by
this test. All actual generated constant access, assignment errors and construction
use common source providers. Full activity/item dependency integration and game
startup remain separate work.
