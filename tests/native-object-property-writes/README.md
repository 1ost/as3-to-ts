# Object-local property assignment

Run `node tests/native-object-property-writes/run.cjs`, optionally with
`--consumer`. The fixture emits the unchanged complete Writer, Slot and Root
subjects from LayaAir's authenticated `object-property-writes` AIR packet.
All 57 rows compare exactly on ES5/ES2015 in Node and Chromium, including typed
setter storage, original assignment results, key/RHS/getter ordering, thrown
marker identity, and null/undefined/primitive source errors. Consumer mode emits
Writer outside the generated class domain. Both modes typecheck their entire
provider graph and record input/output hashes.

`nativeObjectPropertyModule` now lowers simple assignment to as3SetProperty for
the same authenticated Object/wildcard local and parameter paths as reads and
calls. Existing dictionary, lexical and generated-receiver dispatch takes
precedence. Receiver and key are evaluated once before the RHS; the provider
validates and stores after evaluation, returning the original RHS.

Seven rejection guards cover provider mismatch, missing provider import,
namespace emission, update, compound subtraction, delete and property construction.
Dot compound addition is separately qualified by native-dot-property-addition.
Three corrupted comparison inputs must fail. Other mutation forms, bound-field
roots and computed function-return roots still require separate source proof.
This focused fixture does not qualify the full application.
