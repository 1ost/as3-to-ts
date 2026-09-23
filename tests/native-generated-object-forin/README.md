# Object-typed generated for-in

Run `node tests/native-generated-object-forin/run.cjs`, also with `--combined`.
The test authenticates the engine's original AIR packet, emits the complete
unchanged Enumeration subject, strictly checks its types, and compares 25 rows
on ES5/ES2015 in Node/Chromium. Rejection guards preserve the boundaries for
missing providers, numeric targets, inline declarations, member targets and
catch-shadow targets. Three comparison controls reject corrupted observations.

Each iterated key is assigned through the common as3CoerceObject helper.
Numeric keys and object/function identity are preserved, undefined becomes null
at an Object boundary, and zero-iteration loops preserve their initial value.
Existing iterator cleanup, labeled flow and receiver snapshot semantics remain
in use. No source variable is rewritten to wildcard or String. Enumeration
ordering beyond the retained cases, other typed targets, and complete archives
remain separate requirements.
