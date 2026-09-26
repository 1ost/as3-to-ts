# Private static int literals

Run `node tests/native-generated-private-static-ints/run.cjs --combined` after
building the compiler. Three complete AS3 subjects match eleven repeated AIR
observations on ES5/ES2015 in Node/Chromium, with nineteen compiler rejection
checks and zero type errors. Evidence lives in the shared engine's
`tests/nativeFlashOracle/generated-private-static-ints`.

This extends the existing private static String constant path to in-range signed
decimal int literals, including early reads, private child namesakes, lexical
shadowing, computed own-scope access, rejected writes before value coercion,
deletion, hidden public lookup, BaseButton's eight state values, and int limits.
Computed/fractional/overflow initializers, protected static int and private
instance constants remain held. No source implementation is hand-translated.

The actual OP2 worker comparison is
`as3-to-layaair-porting-kit/tests/test_bulk_generated_private_static_ints.mjs`.
Latest compiler pass: `run-QkpEuL`; worker pass: `run-C6ia66`.
