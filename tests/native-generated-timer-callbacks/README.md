# Generated zero-delay timer callbacks

TimerOwner is compiled from its complete original AS3 source. Two identical
Harman AIR 51.3.4 captures establish eight checkpoints: initial/queued/cancelled
state, replacement before dispatch, completed callback, cancelling a completed
ID, and scheduling/completing another callback. Captured owner/parameter values
must survive after schedule returns. Snapshot arrays are copied, not live views.

The compiler selects the shared engine TimerFunctions setTimeout/clearTimeout
exports. ES5/ES2015 generated classes match all eight rows in Node and CSP
Chromium, with no type errors. No runtime/compiler source changes were needed.
Run oracle/verify.cjs and verify.cjs --check-current to authenticate evidence.
The engine's existing scripts/testFlashTimer.mjs also passed all 22 regressions.

This qualifies the observed zero-delay String callback and cancellation path.
It does not establish all invalid argument coercions, timer builtin reflection,
interval behavior in generated source, timing precision, maintained ModuleManager
runtime, the entire client, or font rendering. The real ModuleManager class must
remain unchanged and use the canonical shared provider in its integration test.
