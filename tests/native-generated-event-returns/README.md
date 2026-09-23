# Canonical Event returns and OP2 collection events

Run npm run tsc, then node tests/native-generated-event-returns/run.cjs.
The test verifies the engine op2-collection-events AIR packet and emits all four
subjects intact: three maintained OP2 event classes and EventReturns. Maintained
source bytes must match the captured originals in the sibling OP2 checkout.

All 24 observations compare exactly in Node and Chromium on ES5/ES2015. Strict
type checking includes the actual provider graph. Two compile-time controls keep
Event returns without the explicit canonical nativeBase profile and other native
returns (Date) rejected. The change reuses existing completion-aware return
coercion, including finally overriding an invalid pending return.

Only a flash.events.Event plan binding with canonical eventBaseExport is admitted.
Other native returns, native super method calls and full application integration
remain outside this fixture. Arity observations compare error name/ID at the host
boundary; full Error catch branding and full error text are not qualified here.
