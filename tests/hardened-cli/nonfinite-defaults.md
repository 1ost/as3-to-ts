# Native numeric optional defaults

`nonfinite-defaults.test.cjs` uses the pinned LayaAir AIR fixture with twelve
observations from two identical SWF-29 native runs. It compares emitted source
through `startAS3Application` in Node and Chromium. Omitted, explicit undefined,
null and finite arguments remain distinct for instance methods, static methods,
method closures and lambdas. Optional `NaN`, `Infinity`, `-Infinity` and undefined
are resolved as source globals; class-member shadows and arbitrary named
defaults remain held. Numeric null/undefined arguments use the existing Number
slot coercion rather than JavaScript parameter-default substitution.

The fixture also caught a shared-parser precedence error: `typeof value + text`
previously parsed the whole addition beneath `typeof`. The parser now consumes
one unary operand; the hardened adapter no longer rotates only equality nodes.
The parser normalizer gates and the retained native-typeof suite cover comparison,
parentheses, source binding and the existing common-runtime emitter.

Run with `HARDENED_FIXTURE_AIR_SDK`, `HARDENED_FIXTURE_LAYA`,
`HARDENED_FIXTURE_FFDEC`, and `LAYA_PLAYWRIGHT_MODULE` after `npm run build`.
