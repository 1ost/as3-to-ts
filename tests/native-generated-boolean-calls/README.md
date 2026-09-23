# Direct builtin Boolean conversion

Run `node tests/native-generated-boolean-calls/run.cjs` and repeat with
`--combined`. Two complete AIR subjects yield 25 observations on generated
ES5/ES2015 in Node/Chromium, with zero type errors. Results retain their actual
runtime type through wildcard returns, so a TypeScript assertion cannot pass.
The corpus covers primitive truthiness, arrays/objects/functions/Class values,
no conversion hooks, once-only evaluation, numeric inputs, while/short-circuit
behavior and a private same-named method. Three negative comparison controls
and three provider/arity rejection guards accompany the full-source comparison.

The compiler proves an unshadowed builtin reference and delegates to common
as3CallClass. Direct zero-argument Boolean is rejected by the AIR compiler;
zero/excess source arguments remain rejected by this lowering. Construction
and aliased Class invocation are outside this direct-call regression, as are
complete archive and game execution.
