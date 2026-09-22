# String enumeration locals

Run `npm run build` and `npm run test:native-string-enumeration`.

The exact reference-local plan now admits builtin String loop targets. Existing
for-in/for-each emission invokes the configured common String coercion before the
body, retaining the old value if conversion fails. Header variables keep their
existing undefined-before-assignment behavior; ordinary local defaults remain
null. Dictionary object keys use the common key/property provider.

The unchanged StringEnumerationProbe matches all 13 authenticated repeated AIR
rows in Node/Chromium on ES5/ES2015, with zero strict type diagnostics. Empty loops,
header reads, per-item conversion, failures, receiver rebinding, unbraced branches
and labels are covered. Native String locals and reference enumeration retain
their independent regression suites. This does not establish general source-object
enumeration order, generated class storage or full-client runtime acceptance.
