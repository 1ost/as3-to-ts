# Single builtin SecurityError catch

Run `node tests/native-generated-security-catch/run.cjs --combined` after building.
Use `--consumer` to cover the same complete source without generated Class
registration. Both modes compare thirty authenticated AIR observations on
ES5/ES2015 in Node/Chromium with zero generated/provider type diagnostics.
The observer calls emitted methods; all catch/finally logic stays in the source.

Only an unshadowed builtin SecurityError catch is admitted. Seven compiler
guards reject an unsupported typed error, sibling catch, parameter shadow,
explicit foreign import, substituted native binding, absent common error
provider, and same-package source namesake. Three comparison controls detect
altered observations. Existing Error and bound IOError catches remain supported.

The common private allocation predicate preserves renamed-error selection and
rethrows mismatches unchanged. Host errors, prototype/structural forgeries and
hostile proxies are rejected without inspecting proxy traps. Native positive
inputs use the previously qualified fullscreen-denial factory; constructor
fields are not observed here. This supplies no public SecurityError Class,
constructor, subclass-entry or reflection authority. Full UIComponent execution
and game integration are not qualified by this fixture.
