# Generated chained reference reads

Resolve public source fields and getters through their authenticated declaration
types before emitting a chained read. Each step uses common property dispatch;
no getter is evaluated during type discovery and no receiver expression is
duplicated. Missing properties on explicitly dynamic generated receivers return
the source value through that same provider. Do not fabricate declarations or
expose Laya implementation fields to solve TypeScript compatibility errors.

Six original AS3 classes produce 11 identical observations in two Flash 26 runs.
ES5/ES2015 match in Node and Chromium with zero type errors: getter counts,
inherited fields, local-root chains, missing/present dynamic properties despite
a caller's private namesake, null at either intermediate receiver, failed
reference coercion retaining prior storage, and constructor argument order when
a later argument replaces the referenced field. Three guards reject absent
dynamic-read authority and unqualified dynamic chained writes/calls.

Run `npm run tsc` then `node tests/native-generated-chained-references/run.cjs`.
`verify.cjs` authenticates original evidence; `verify-runtime.cjs` authenticates
the retained results and implementation hash. Capture with the shared engine's
`scripts/nativePepperOracle.py --entry ChainProbe`, supplying the source folder,
a fresh output folder and the Flex/playerglobal/Electron/Flash paths. The
receipt retains exact tool and source hashes. Browser profiles are ignored.

Adjacent foreign-method tests pass nine rows and six guards; accessor locals
pass 36 rows and seven guards in baseline and combined modes, all on both
targets and Node/Chromium. This is shared language qualification; OP2's authored
loading-controller runtime and whole client still require integration testing.
