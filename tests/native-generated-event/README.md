# Generated canonical Event subclasses

Run npm run build, then npm run test:native-generated-event. The test authenticates
retained native AIR evidence in the sibling LayaAir-op2 checkout and emits the
original EntryEvent, ShadowEvent, BaseEvent and LeafEvent AS3 bytes. It checks
12 AIR observations on ES5 and ES2015 output in Node and Chromium, plus strict
provider-graph types and 10 compile-time rejection cases. The TypeScript observer
collects the emitted classes' behavior; it does not transpile the AIR host probe.

The explicit declaration provider profile is:

    'flash.events.Event': {
        module: '<common AS3CanonicalEventConstruction module>',
        exportName: 'Event', nativeBase: 'Event'
    }

Source imports must bind to that same canonical Event constructor. Planning
imports its declaration identity and frozen native constructor entry. Generated
entry prepares Event state before source field effects, then lowers the explicit
super call to initialization of that same receiver. Common engine code owns
Event behavior and private native storage. Source lexical scopes stop at its
opaque native boundary. Same-spelled parent/child private fields remain distinct.
The fixture checks inherited trait names, accessor types and method arities
against all 13 method/accessor entries in the pinned canonical AIR reflection.

Covered observations include pre-super defaults and failed-construction state,
String/Boolean conversion order, thrown-object identity, bound native methods,
authored _type storage, static constant shadowing, ancestry and source private
field initialization through two generated generations.

This profile does not admit other native bases. Missing, repeated or conditional
native super calls, unsupported native overrides and native super method calls
remain explicit failures. Reference constructor parameters and typed generated
method returns beyond canonical Event require further qualification. Canonical
Event returns now have separate 24-row AIR coverage in native-generated-event-returns. Complete generated reflection,
application cohort admission and gameplay validation are not established here.
Reports and actual input/output hashes are retained under .cache/native-generated-event.

The command runs both with and without reference-coercion checking, matching
the combined bulk-worker configuration. Only generated Event ancestry admits
the qualified native is test; as casts and Event tests without that ancestry
remain rejected (two additional combined-mode guards).
