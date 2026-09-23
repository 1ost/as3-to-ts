# Native Date binding

Run `npm run test:native-date-binding` after building with the sibling OP2 engine
and its authenticated Date evidence. Original DateConstructionProbe,
DateEpochControlsProbe and DateUtcMutationProbe sources are emitted unchanged.
Twenty-five native AIR observations (allocation, nine numeric epoch rows and
fifteen UTC/mutation rows) match Node and Chromium for
ES5/ES2015. A supplementary generated probe checks Date.prototype, host/prototype
forgery rejection, reference coercion and ordinary local defaults. Nine emission
guards check missing bindings, unsupported conversions and name shadowing.

The full epoch source retains its string constructor branch. Its unsupported
string argument produces exactly one TS2345 diagnostic against the real numeric
provider signature; the test asserts this diagnostic rather than hiding the
branch or claiming a clean whole-source type check. String parsing remains port
work. DateZipProbe's reference parameters also remain outside this restored
consumer lowering; its provider comparison is separate engine evidence.

`nativeGlobalModules.Date` imports `AS3Date` under a collision-safe alias for
source type and value positions. Lexical and imported Date names are preserved.
Builtin Date `is` uses the explicit common `nativeComputedTypeTestModule` proof,
not host instanceof. Planned Date locals require that global binding and reuse
the same alias in injected defaults. Callable Date conversions and Date `as`
remain explicit holds; Class metadata and reflected operations are not admitted.

UTC/mutation results use the AIR JSON capture representation; this comparison
does not distinguish signed zero. The full graph still has only the one
unsupported string-constructor diagnostic described above.

Reports, emitted source and actual bundled dependency hashes are retained under
`.cache/native-date-binding`. This is compiler/provider integration evidence,
not whole-client or in-game completion.
