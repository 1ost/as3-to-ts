# Generated protected static integer updates

Generated lexical prefix/postfix increment and decrement now admit protected
static int variables, including inherited declaring-class storage. Compound
subtraction uses that same class receiver instead of an instance receiver.
Storage conversion stays in the common provider; expression results retain the
unwrapped Number. Existing instance and private uint update paths are preserved.

Four complete AIR source units produce 86 matching observations in Node and
strict-CSP Chromium for ES5 and ES2015. The fixture covers direct, cross-package
and file-private inheritance; prefix/postfix overflow; subtraction conversion
and exception ordering; static methods; shared storage and protected visibility.
Six rejection guards, four applied mutations per target and zero type diagnostics
pass. Mutations alter owner identity, wrap a prefix result, discard a subtraction
write, and move its read after conversion. The adjacent inherited static suite
passes 14 AIR rows, three guards and two mutations on both targets and realms.

```
npm run tsc
node tests/native-generated-protected-static-numeric/run.cjs
node tests/native-generated-protected-static-numeric/verify.cjs --check-current
```

The runner uses the unchanged context-menu-clipboard runtime checkout. AIR
sources are in the protected-static-numeric evidence-only engine checkout.
The adjacent inherited-static runner accepts AIR_EVIDENCE_REPOSITORY separately
from LAYA_ENGINE_REPOSITORY. The combined archive authenticates source/compiler
inputs, generated artifacts, both AIR captures, positive/mutated runtime bundles,
type-program inputs and the original rejection. This does not prove whole-client
factory emission or real H5 acceptance. Other static types remain guarded.
