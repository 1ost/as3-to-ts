# Complete activity module Array reads

Run npm run tsc, then node tests/native-generated-activity/run.cjs.
Requires the OP2 activity-step-generated AIR evidence packet (root commit
0b482b0e) and the isolated LayaAir-op2 engine.

All eight maintained subjects are emitted through the production module factory.
The observation adapter matches the root packet's driver byte-for-byte. Both ES5
and ES2015 run all 24 AIR observations in Node and Chromium under CSP that forbids
runtime compilation, with complete generated-source type checks. Report inputs
include compiler sources and bundle/type dependencies.

The regression is public Array field reads on this: direct JavaScript length or
index operations leaked host TypeErrors for null. The emitter authenticates the
field's builtin Array type from generated traits and uses common as3GetProperty.
It does not alter writes, updates, calls, nonpublic storage or computed roots.
No engine behavior or maintained game source changes are required.

Two applied mutations restore raw length/index reads in the generated factory.
Each mutated bundle must build, then fail with the former unbranded host null
TypeError. A mutation build failure is a test failure, not a successful control.
This does not qualify full client startup or arbitrary Array methods.
