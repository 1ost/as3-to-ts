# Inherited protected static int and source-reference fields

Run `node tests/native-generated-inherited-static/run.cjs`. Five original source
units, including a file-private subclass, match 14 repeated AIR 51.3.4 observations
on ES5/ES2015 in Node and strict-CSP Chromium with zero generated/provider type
errors. Direct, deeper and cross-package inheritance share the declaring class's
storage; int conversion, assignment results, reference identity, null conversion,
failed reference writes and protected visibility retain the observed behavior.

The change admits only authenticated intrinsic int and source-class reference
fields through the existing ancestor constructor selection and common lexical
provider. No engine runtime changes or application-local substitutions are used.
Three compiler rejection checks and two executed mutations per target verify
rejection boundaries, wrong ancestor selection and discarded reference writes.

`verify.cjs --check-current` validates the retained runtime archive and baseline
failure. `verify-adjacent.cjs --check-current` validates another 23 AIR rows for
protected static Boolean/String behavior, with 16 rejection checks and zero type
errors. Those older browser harnesses do not enforce strict CSP. Their source
fixtures are unchanged. The Boolean runner's obsolete private uint rejection is
replaced by a protected uint rejection; the old assertion also failed with the
pre-change compiler, where private uint literals were already qualified.

The baseline reproduces `inherited static lexical ownership`. The final runner
also explicitly selects Base as a class-script source for its static initializer;
that binding is separate from the inherited-field admission change.

This proof does not establish full OP2 factory assembly, application runtime
integration, other inherited storage forms or real H5 account acceptance.
