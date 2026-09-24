# Generated loaded interface cohorts

Run `npm run tsc`, then `node tests/native-generated-loaded-interfaces/run.cjs`.
Use LAYA_ENGINE_REPOSITORY to override the isolated sibling LayaAir-op2 checkout.
The engine needs the mixed source-type loading API (d5132add4 or its descendant).

The runner authenticates the retained loaded-interface-values AIR evidence and
compiles complete unchanged sources through emitNativeSourceClassModule:

- Parent cohort: shared.IRoot, shared.IValue, shared.Parent.
- Child cohort: shared.IRoot, shared.IValue, child.IChild, child.Implementation,
  child.Lookalike, child.Reader.

Only the Sprite/Loader observation adapter is native test code. Parent and child
class bodies, interface signatures, typed storage and method returns all come
from the retained source. All 61 observations match on ES5/ES2015 in Node and
Chromium. Browser CSP disallows runtime code compilation. The type checker reads
every emitted subject, interface, declaration module and transitive provider.

Five runtime lifetime checks complement the AIR rows. Mutations disabling
interface selection or sharing the generated cohort cache must fail. Four source
guards retain holds for static interface Class initialization, direct interface
calls/construction and interface static member access. An interface-only cohort
is also checked for complete emission. Reports preserve source hashes, generated
artifacts, type inputs, bundle inputs and observer/runner hashes under
.cache/native-generated-loaded-interfaces.

This qualifies generated interface identity/publication in the selected source
cohorts. It does not qualify full OP2 startup, inherited proxy overrides, arbitrary
static initialization, direct interface call syntax or the document Sprite.

Related regression: native-generated-inherited-classes/run.cjs --factory --combined
matches 47 AIR rows. Its missing-inheritance mutation targets the shared
selectSourceType seam and checks that the mutation actually applies.
