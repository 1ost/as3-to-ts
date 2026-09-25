# Lexical name collisions

Run `npm run tsc`, then `node tests/native-generated-name-collision/run.cjs`.
The original method-intrinsic AIR capture is used unchanged: a private static
join method contains rest.join and another class publishes public static join.
Both previously failed lexical ownership checks due to the private namesake.
Rest parameters now carry intrinsic Array metadata; intrinsic Array members
and authenticated foreign public statics defer to their own dispatch paths.

All 17 AIR rows pass through complete production factories on ES5/ES2015,
Node/Chromium CSP, with zero generated/provider types. A foreign-private guard,
two domain checks and an applied join-separator mutation also run. The changes
do not grant access to a foreign private declaration or invent native members.
