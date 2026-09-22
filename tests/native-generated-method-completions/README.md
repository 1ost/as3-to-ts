# Generated method completions

Run node tests/native-generated-method-completions/run.cjs, with optional
--combined to enable overlapping reference/signature passes. The test authenticates
engine packets generated-method-completions (19 rows) and
generated-return-cancellation (4 rows), emits their three complete source classes,
and compares a separate host observer in Node/Chromium on ES5/ES2015.
Generated and provider dependencies type-check with zero diagnostics.

Wildcard primitive literal defaults preserve omission versus explicit undefined.
A conservative source flow check admits exhaustive if/else, switch fallthrough
and try/catch/finally completions. It does not prove loops exhaustive.
Typed return expressions are captured before authored finalizers, then converted
after the outermost active authored finalizer. Enclosing catches cancel pending
returns when they catch a finalizer throw; catches within a finalizer do not.
Returns/throws from finalizers replace pending completions. Generated iterator
cleanup is distinguished from authored finalizers by collision-safe source marks.

Nine rejection guards retain computed defaults, incomplete branches/switches,
bare returns and finalizer jumps as holds. Three negative comparison controls
cover omissions, ordering and conversion/finalizer order. Source/provider/observer
hashes and runtime rows are retained in the ignored per-run report. This fixture
does not establish complete ObjectUtil or application runtime parity.
