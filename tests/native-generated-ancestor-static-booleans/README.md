# Protected static Boolean storage across source ancestors

The shared compiler previously rejected a protected static Boolean declared
beyond the direct parent. The OP2 example is Step._previousLock inherited by
GuideStepClick through GuideStep. Simply removing the guard selected the wrong
constructor: lexical static storage requires its declaring generation.

The compiler now follows the selected base constructor chain by the authenticated
source ancestry depth. It reuses the existing lexical capability and runtime
checks. Only protected Boolean variables gain deeper ancestry support; deeper
String/Vector/constants and ambiguous declarations retain their guards. The
engine is unchanged at 9bc1976d7504bc3904a5e575e1403105dfe14e5d.

Five complete source classes span four levels, two packages beyond the base, and
a sibling. Two identical AIR 51.3.4 captures establish 26 observations covering
early/default/computed initialization, static and instance reads/writes, ancestor
sharing and sibling visibility. ES5 and ES2015 match in Node and Chromium, with
zero type errors, 16 compiler guards, two applied wrong-receiver controls per
target and realm, and three additional checks for separate declaration domains.
The baseline compiler 3e14ebd rejects the same source with the retained OP2 hold.

Adjacent regressions cover Boolean initialization (10 AIR rows), String static
storage (13), protected constants (21) and static Vectors (28), in both targets
and runtimes. The Vector suite also uses CSP Chromium. The new suite uses the
existing dynamic module test harness; it does not claim CSP qualification.

From this checkout, set LAYA_ENGINE_REPOSITORY to the pinned engine worktree,
run npm run tsc and node tests/native-generated-ancestor-static-booleans/run.cjs
--combined. baseline.cjs reruns the original compiler rejection. Reproduce AIR
using the engine scripts/nativeFlashOracle.py with --source pointing to
oracle/source, --entry StaticBooleansProbe and a new --output directory.
retain.cjs accepts the five completed report.json paths (ancestor, Boolean,
String, constants, Vectors). verify.cjs --check-current authenticates retained
reports, original AIR artifacts, compiler/helper/test inputs and provider hashes.

This is compiler qualification, not maintained GuideStepClick emission, whole
client types, H5 startup or account acceptance. OP2 must refresh its pinned
consumer proofs and replay the focused class before resuming the full factory.
No font rendering changes are included.
