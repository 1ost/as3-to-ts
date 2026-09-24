# Canonical MovieClip reference operations

Run `node tests/native-generated-movieclip-references/run.cjs --combined`, with
and without `--consumer`. One complete unchanged Reader matches 22 authenticated
AIR observations on ES5/ES2015 with initialized Laya in Chromium, with zero
fixture/provider type errors. No Node runtime comparison is claimed.

The explicit nativeMovieClipReferenceModule must match the authenticated plan
and import binding. Constructor casts, operand side effects, is/as, typed locals,
MovieClip/subclass identity, unrelated native objects, nullish values and source
coercion errors are compared. Nine compiler guards, three comparison controls
and runtime forged-prototype/constructor/proxy checks remain enforced.

This does not grant arbitrary Class evaluation, class-initializer operations,
generated display construction, MovieClip reflection or UIComponent readiness.
