# Generated Sprite value references

Run `npm run tsc`, then `node tests/native-sprite-value-references/run.cjs`.
Requires the isolated engine's `AS3CanonicalSpriteValueReferences` and its
authenticated `nativeFlashOracle/sprite-value-references` packet.

The complete unchanged SpriteValueHolder.as passes all 96 AIR observations through
the production module factory on ES5/ES2015, in Node and Chromium under CSP without
runtime compilation. Transform, SoundTransform and AccessibilityProperties each
cover constructor parameters, field storage, getters, method parameters/returns,
is/as, nullish input and rejected references. The captured superclass is Object.
The fixture typechecks the generated source and complete provider graph with
zero diagnostics, including DOM iterable declarations needed by Transform.

The explicit `nativeSpriteValueReferenceModule` must match every selected native
value provider and import binding. Thirteen compiler guards reject missing or
mismatched bindings, shadowed type names and unsupported native inheritance.
Thirty-six runtime guards check exact nominal tokens, independent value families,
forgeries, proxies without traps, foreign same-name declarations, typed slot
rejection without mutation, and the absence of invented Class reflection.

The native objects use the existing engine allocation proofs; no OP2 substitute
or partial Sprite trait surface is introduced. Source Class reflection, dynamic
construction, member dispatch, generated native subclasses, remaining Sprite
property types and full BaseModule/Game admission remain separate requirements.
The OP2 bulk-worker fixture is `test_bulk_sprite_value_references.mjs`.
