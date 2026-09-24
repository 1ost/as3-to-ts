# Complete-source Class script retry comparison

Run node tests/native-generated-class-script-retry/run.cjs after npm run tsc.
Both complete unchanged subjects, retrycases.Trace and retrycases.Retry, come
from the common engine's authenticated script-global-initializer-retry packet.
All thirteen AIR rows match through the production module factory on ES5/ES2015
in Node/Chromium, with zero output/provider type errors and browser CSP disabling
runtime compilation. Five domain isolation/inheritance checks pass per target.

The explicit classScriptSources declaration-plan selection uses the common
instantiateAS3ClassScriptUnit provider (qualified in engine 52761b9a7). An
initializer failure retains its escaped global/functions with a null qualified
Class binding, while the next attempt allocates new identities. Success publishes
once. Failed factory values never enter the native Class cache. Original source
bodies and return annotations are unchanged.

Ten guards require a nonempty unique planned root-Class selection and explicit
script domain/provider, preserve old unselected initializer holds, and reject
class-body initializers and selected classes with a base. An applied mutation
switches back to the old generic script provider; the retained-closure check must
then fail on both targets. Anonymous Object returns and typed local Function
call/apply have independent AIR/factory comparisons in sibling test directories.

This admits selected root-Class field initializers, not arbitrary class-body
statements, initializer cycles, derived-Class initialization, package-internal
aliases or multi-declaration scripts. Application classes still require their
own complete source dependency and runtime checks; this is not full OP2 startup.
