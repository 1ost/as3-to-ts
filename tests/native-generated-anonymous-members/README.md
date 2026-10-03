# Anonymous callbacks capturing source members

The OP2 full factory emits 568 classes, then stops in maintained ModuleManager.
Its delayed anonymous callback captures owner fields and a method parameter,
contains typed locals and try/catch, and calls inherited event dispatch. The baseline shared compiler rejected anonymous receiver/member lookup before
the remaining anonymous-body restrictions were reached.

This prerequisite fixture contains complete ClosureBase and MemberClosure AS3
classes, observed after their callback-producing method returns. Seven original
AIR rows, captured identically twice, cover private fields and methods, inherited
public calls, distinct owners and parameter captures, repeated invocations,
try/catch, and explicit foreign/null call receivers. A foreign call receiver
does not replace the captured source owner. Typed Object locals and error paths
remain part of the unchanged subject, not substitutions in the observer.

Run oracle/verify.cjs to authenticate the original evidence. baseline.json records
the unchanged 577d2e105a compiler rejecting both ES5 and ES2015 with the same
anonymous member diagnostic as ModuleManager. It records compiled and source
input hashes. Reproduce on that baseline by building the compiler, then running
baseline.cjs from its checkout root. The compiler helper reads these exact
original source classes from the retained AIR receipt.

The compiler now captures the creating owner separately from dynamic callback
this, lowers ordinary anonymous typed locals in their own scope, and preserves
captured outer local writes and try/catch behavior. Four additional original AIR
rows cover uint/int storage versus raw assignment results for overflow, fractions,
undefined and string input. Both original captures agree for all eleven rows.

run.cjs verifies these exact eleven observations under ES5/ES2015 in Node and
CSP Chromium, with twelve rejection guards, two applied wrong-behavior controls,
and zero type errors. report.json.gz additionally retains 100 regression rows:
anonymous Object returns (17), generated typed locals (47), and DataEvent (36).
Run verify.cjs --check-current to authenticate retained results and input hashes.
The baseline evidence remains independently verifiable with verify-baseline.cjs.

Nested anonymous functions, explicit this.property access, super/arguments,
shadowing outer storage, const/Vector anonymous locals, and unqualified parameter
types remain guarded. Native timer integration, maintained ModuleManager runtime,
and full-client startup/account validation remain open. Font rendering is outside
this work.
