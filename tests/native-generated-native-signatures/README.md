# Native references in inherited method signatures

The complete Parent, Child and Grandchild sources plus their namespace declaration
come from the engine's authenticated native-signature-override AIR packet.
`run.cjs` generates them through the production module factory for ES5/ES2015.
All 37 observations match in Node and Chromium under CSP without runtime code
generation. Generated/provider type checks pass.

Native parameter and return signatures use exact planned reference tokens.
Typed super calls preserve the source parent's argument and return conversions.
Other native operation guards still apply. Four compiler guards reject changed
parameter/return types, changed required counts and absent providers. Two applied
controls restore the old signature omission and old super-parameter restriction;
each rejects the unchanged fixture on both targets.

Run `npm run tsc`, then `node tests/native-generated-native-signatures/run.cjs`.
Set LAYA_ENGINE_REPOSITORY to the isolated native-signature engine if needed.
`verify.cjs --check-current` verifies retained results and unchanged inputs.
The --baseline diagnostic flag is for the old compiler implementation only and
does not claim runtime comparisons. Full ParagraphElement/PagraphData emission,
application behavior and game startup remain separate requirements.
