# Anonymous callbacks capturing source members

The OP2 full factory emits 568 classes, then stops in maintained ModuleManager.
Its delayed anonymous callback captures owner fields and a method parameter,
contains typed locals and try/catch, and calls inherited event dispatch. The
current shared compiler rejects anonymous receiver/member lookup before the
remaining anonymous-body restrictions are reached.

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

Implementation and Node/browser parity remain pending. Do not remove the guards
without lowering captured owner access separately from an anonymous function's
dynamic this, preserving typed local/error semantics, and validating the original
rows. Native timer integration, maintained ModuleManager runtime, full-client
startup/account validation and all font rendering are outside this fixture.
