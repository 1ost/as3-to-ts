# Canonical InteractiveObject references and typed returns

Run `node tests/native-generated-interactive-references/run.cjs --combined`,
with and without `--consumer`. The complete Reader matches 36 repeated AIR
observations on ES5/ES2015 with initialized Laya in Chromium and zero generated
or provider type diagnostics. No Node runtime comparison is claimed.

The explicit nativeInteractiveObjectReferenceModule must match the authenticated
source/provider/import plan. Constructor casts, is/as, local coercion and direct
reference returns preserve source nominal ancestry, nullish behavior, evaluation
count and coercion errors. Nine compiler guards, three comparison controls and
runtime forged-prototype/constructor/proxy controls pass.

This addresses the return type required by UIComponent.getFocus; it does not
qualify that complete method's focus/stage behavior, generated native subclass
entry, Class-initializer operations or the whole UI component.
