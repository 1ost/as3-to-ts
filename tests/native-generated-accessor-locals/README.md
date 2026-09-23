# Generated accessor local storage and signatures

Run `npm run test:native-generated-accessor-locals`. Three complete classes and
one interface from the authenticated engine AIR packet are emitted unchanged.
All 36 rows match on ES5/ES2015 in Node/Chromium, with baseline and combined
reference/numeric passes, zero strict type diagnostics, seven rejection guards
and five altered comparisons. Only the observer host is adapted.

Generated getter/setter local plans use source kind as well as name and static
ownership. Same-name accessors can therefore have different local types without
sharing defaults or conversion plans. Local ownership suppresses prior numeric
rewrites; shared local lowering preserves hoisting, raw assignment results,
numeric wrapping, class/interface identity, hooks and thrown-value identity.
Accessor entry/return signatures now use the common generated callable path;
the older numeric signature pass does not independently convert setter inputs.

The linked Cell getter covers the traversal structure needed by SlotList.length.
It does not replace or qualify SlotList itself. The old generated-local getter
rejection test now checks a typed const in a getter, which remains unsupported.
Static NIL initialization, typed exception-region returns, nested accessor
closures, accessor inheritance, full error text/brand and whole Signal runtime
are not established by this packet. Legacy nongenerated accessor emission is
outside this change; it does not acquire generated local plans.
