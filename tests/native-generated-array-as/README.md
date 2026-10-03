# Generated Array as checks

Generated source must retain runtime checks for `value as Array`. An erased TypeScript assertion allowed a typed local to throw a coercion error instead of receiving null, preventing OP2 TabStopsProperty from taking its string parser branch.

The emitter now lowers an unshadowed built-in Array target through the shared as3As helper. A shadowed Array target fails closed pending Class operand authority. The left operand is evaluated once.

Run `node tests/native-generated-array-as/run.cjs`. The pinned AIR oracle has 12 observations from two identical captures: valid arrays preserve identity; other values yield null; typed locals, returns, expressions, side effects and thrown evaluation are covered. ES5 and ES2015 each match in Node and Chromium under script-src self, with zero type errors, three domain checks, three rejection guards and one rejected erased-cast mutation. Adjacent generated Vector construction passes 35 AIR rows and 22 domain checks for both targets.

This focused result does not establish full client acceptance. The maintained OP2 parser must be replayed separately.
