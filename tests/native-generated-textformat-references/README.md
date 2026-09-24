# Canonical TextFormat reference operations

Run `node tests/native-generated-textformat-references/run.cjs --combined`,
with and without `--consumer`. A complete unchanged Reader matches thirty AIR
observations on ES5/ES2015 in Chromium with initialized Laya, with zero fixture
and provider type errors. There is no Node runtime claim.

Explicit nativeTextFormatReferenceModule must match its authenticated plan and
import binding. Tests cover is/as, typed-local coercion, one operand evaluation,
native subclass identity, nullish/primitive/dynamic inputs, and UIComponent's
same-Object style predicate. Nine compiler guards, three comparison controls
and forged prototype/Class/proxy checks pass. Full TextFormat constructors,
reflection, generated subclass entry and UIComponent runtime remain separate.
