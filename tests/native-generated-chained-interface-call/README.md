# Chained source interface method calls

The lexical emitter follows authenticated source getter/field return types into
source interface method contracts, including source interface inheritance. It
emits common method dispatch after evaluating the entire receiver and arguments.
The class-only internal ancestry walk no longer dereferences interface entries.

Run npm run tsc, then node tests/native-generated-chained-interface-call/run.cjs.
The default engine is ../LayaAir-op2-chained-interface-call-review; override with
LAYA_ENGINE_REPOSITORY. Six complete classes and two interfaces match 18 repeated
AIR 51.3.4 observations on ES5/ES2015 in Node and strict-CSP Chromium. The subject
forwards Function/Object/Array arguments via Function.apply and preserves an
optional Boolean flag and wildcard return, matching the ISWFContext call shape.
Tests cover own/inherited getters, nested interface getters, default/explicit
arguments, own protected namesakes, receiver replacement in arguments, null
receivers and argument side effects. Generated/dependency types have zero errors.

Six rejection guards cover method extraction, writes, construction, absent
property authority, private getter authority and incompatible contracts. Two
applied mutations per target detect incorrect method dispatch and repeated
receiver getters. The unchanged fixture crashes on the preceding compiler with
an undefined class-base dereference. No engine runtime change is required.

node tests/native-generated-chained-interface-call/verify.cjs authenticates all
retained inputs and runtime evidence; --check-current also compares disk bytes.
Adjacent interface-cast/private-field calls (44 rows), chained getters (13) and
namespace namesakes (16) pass on both targets against these final inputs.
Method extraction, writes and construction remain separate qualifications.
Complete BaseCompose emission, the full factory and actual H5/account acceptance
require additional integration evidence.
