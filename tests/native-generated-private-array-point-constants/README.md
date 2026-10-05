# Private static Array and Point constants

Authenticated private static Array and Point constants publish null before Class
initialization, then acquire a one-shot immutable binding at their authored
initializer position. Point requires the validated native reference option.
The common reference initializer checks exact intrinsic Array or canonical Point
identity and applies typed coercion before committing storage. Constant contents
remain mutable; source assignment to the binding remains rejected.

The unchanged AIR source cohort matches 16 observations in ES5/ES2015, Node and
strict-CSP Chromium, with zero generated/dependency type errors. It exercises two
failed Class initializations and successful retry, fresh Classes and objects,
retained failed generations, literal element effects, early nulls, stable identity,
null initializers and content mutation. Seven compiler guards and 27 host/domain
checks cover provider authority, one-shot initialization, failed coercion,
constant assignment, wrong capabilities/owners, malformed traits, independent
source domains and inherited domain reuse. Three mutation controls per target
(skip publication, wrong Point coordinates, missing first element effect) are
detected in both runtimes. The pre-fix compiler rejection is retained.

Adjacent Object constants pass 15 AIR rows and 20 lifecycle/domain checks for both
targets and runtimes (run-ZhW0U0). Run run.cjs with LAYA_ENGINE_REPOSITORY and
PLAYWRIGHT_MODULE configured. verify.cjs authenticates the retained runtime archive;
--check-current verifies current input bytes. Archive: 3375636 bytes, SHA-256 c19e7e29f9ae4b5201be02aeedc2f3aebc977586da883d0c4df6bae03cda8986.
Whole-client factory/runtime and H5 acceptance remain open.
