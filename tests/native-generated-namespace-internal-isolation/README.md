# Namespace traits alongside package-internal lookup

With the package lexical provider enabled, the foreign internal-member scan
previously classified custom-namespace members as package-internal. It rejected
FlowElement's param2.getStyles() even though the original Game bytecode calls the
opened tlf_internal namespace. The shared scan now excludes authenticated custom
namespace traits and leaves their resolution to the existing namespace path.

The test compiles three complete original Classes and their namespace declaration
from engine evidence 75566b4bb. Seven original AIR rows match ES5/ES2015 in Node
and Chromium, with zero type errors. Coverage includes same- and cross-package
method/field/constant/getter access, static methods, writes and bound closures.
The same-package peer also exercises real internal fields, methods and getters.

Five guards reject foreign internal fields/methods/getters, a conflicting
namespace URI and a copied plan. An applied in-memory compiler mutation removes
the new exclusion and restores the original cross-package rejection per target.

Run node tests/native-generated-namespace-internal-isolation/run.cjs after building.
Retained report: run-tWqTGD. Verify with
node tests/native-generated-namespace-internal-isolation/verify-runtime.cjs --check-current.

Adjacent regressions: full namespace traits full-F8k82J (46 rows), Proxy namespace
isolation run-lQ6MkW (20 rows), internal methods run-c7hO2b (16 rows), internal
getters run-swgr5t (13 rows). Full OP2 factory and application startup remain open.
Internal storage run-lIjyah also passes all 19 rows and 15 rejection guards.
