# Literal XML child calls and XMLList returns

The unchanged `model.ChildReader` and `model.ListReturn` sources are authenticated
against two independent original AIR captures at engine commit
`84e111889ef029e31f1f7a83ecc903d74989114b`. All 18 child-method observations and
nine return-coercion observations match ES5 and ES2015 output in Node and CSP
Chromium, with no type diagnostics.

Literal `child("name")` calls on authenticated XML/XMLList receivers lower to the
existing common `as3XMLChildNamed` helper. Selected-list length, stringification,
`typeof`, and typed XML loops are preserved. The loop converts the native list
to its node array before ES5's indexed iteration. Canonical XMLList method
returns use the existing common reference coercion, including wrong-type errors.

Eleven compiler guards keep missing/mismatched providers, copied plans, dynamic
names, wildcard/qualified names, numeric indices, invalid arity, and non-XML loop
variables held. Two applied controls restore the old child-call or return-type
restriction and each rejects the unchanged subject. The separate engine fixture
also detects descendant selection and lost XMLList receiver aggregation.

Run `run.cjs`, or authenticate the retained result with `verify-runtime.cjs
--check-current`. Adjacent child-attribute (27 rows) and children enumeration
(23 rows) fixtures pass both targets. This does not qualify game startup,
wildcards/QNames, indexed child selection, or XML mutation.
