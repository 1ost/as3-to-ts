# Native EventDispatcher listener super calls

Generated direct `super.addEventListener` and `super.removeEventListener`
previously failed because native methods are absent from source ancestry.
The compiler now selects their exact qualified native prototype descriptors,
including through source ancestors, and invokes them with the source receiver.
It preserves source method overrides higher in the chain and namespace keys.

Arguments are evaluated once, then converted from last to first to the AIR
signature. In the AIR probe, priority conversion precedes event-type conversion;
an invalid Function listener stops conversion before event type. Omitted
optional arguments remain omitted. Capturing the parent method avoids virtual
re-entry into the override. Other native methods, apply calls, unsupported
arity and unqualified providers remain rejected.

All 27 behavior observations from two identical AIR captures match ES5/ES2015
factories in Node and strict-CSP Chromium. Original AS3 subjects include native
overrides, namespace storage, source descendants, an indirect native ancestor,
wildcard parameters, default arguments, fractional/infinite priority,
conversion order, source errors and thrown-value identity. Complete generated
sources, the observer and imported engine graph type-check without errors.

Seven guards include an applied compiler mutation restoring the previous native
super rejection. Two runtime mutations remove priority conversion and reverse
conversion order; both are detected in both realms. Adjacent namespace (12
rows), accessibility (12 rows) and dispatcher retry (19 rows) pass both targets
and realms with zero type errors. The previous namespace suite now verifies
successful listener super emission while retaining other native method holds.

Run `npm run tsc`, then `node tests/native-generated-dispatcher-super/run.cjs`.
LAYA_ENGINE_REPOSITORY selects the engine; PLAYWRIGHT_MODULE can select the
installed browser test package. `verify.cjs --check-current` verifies current
inputs against the retained qualification; omit the flag for portable evidence.
The archive includes AIR source/captures, compiler/type/bundle inputs, generated
factories, mutations and adjacent reports. The baseline compiler source is
retained at 632a1f0efc8111784d43f79a7ce331c3efe84f90.

This qualification does not prove full TLF factory or H5/account acceptance.
