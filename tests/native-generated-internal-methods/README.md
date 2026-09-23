# Generated internal instance methods

Run `node tests/native-generated-internal-methods/run.cjs --combined` and without
`--combined`. Six complete classes and one interface from the retained AIR packet
are emitted unchanged for ES5/ES2015, compared in Node/Chromium with sixteen AIR
observations, checked for zero type errors and nineteen compiler rejection guards.

Admitted methods have one required source-interface parameter and Boolean/void
return. Typed receiver calls evaluate arguments before dispatch; indexed dynamic
calls read the bound method first. Same-package overrides and cross-package
namesakes preserve source identity. Method writes, arity failures, reference
coercion, deletion and public reflection are included in the comparison.

Static/internal super calls, optional/rest or other signatures remain held.
Canonical IDataInput/IDataOutput providers and complete ZipFile are separate
requirements; the language probe is not substitute archive code.
