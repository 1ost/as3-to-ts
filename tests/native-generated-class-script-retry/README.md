# Pending complete-source Class script retry comparison

This is an investigation checkpoint, not a passing generated runtime test.
Run node tests/native-generated-class-script-retry/run.cjs --expect-held to
reproduce the current first compiler hold: anonymous typed return held, from
Retry.begin's complete original function():Object { return this; } expression.
The command succeeds only for that exact hold. Omit the flag to run the actual
emission/type/Node/Chromium comparison once prerequisites are implemented.

The two complete unchanged subjects come from the common engine's authenticated
script-global-initializer-retry AIR packet (f0b4504ec). The observation host is
prepared to compare all thirteen original rows through the production module
factory and source loading session. The full test currently fails before module
emission; no generated runtime or type success is claimed.

The common single-Class script provider is qualified at engine 52761b9a7. Next:
support this anonymous Object return with original-runtime evidence, add explicit
compiler authority for the new Class-script provider, and then resolve further
holds exposed by these unchanged subjects. Keep unsupported initialization forms
guarded. Do not remove source statements or alter the AIR subjects to pass.
