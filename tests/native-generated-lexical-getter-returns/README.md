# Qualified lexical getter return types

Private/protected read-only instance getters now admit authenticated intrinsic
Number and Object returns and public source-class declaration references.
Boolean getters retain their previous behavior. Exact resolved return identities
must match protected overrides; `super` resolves the selected source ancestor.
Package-internal non-Boolean getters, static getters, setter halves, interfaces,
native references, private-declaration return types and other primitives remain
outside this change. Existing complete engine accessor pairs are unchanged.

The engine fixture `tests/nativeFlashOracle/lexical-getter-returns` captures 24
observations twice on AIR Desktop 51.3.4. Complete source classes are emitted for
ES5/ES2015, checked with their provider graph, and executed in Node and strict-CSP
Chromium. Numeric coercion, null/undefined, reference identity and failures,
private defining-class/peer access, protected virtual/deep cross-package super
reads, single getter execution and public visibility are covered. Seven compiler
rejections and two executable mutations per target pass; there are zero type
errors. `baseline-failure` retains the unchanged compiler rejection.

The adjacent packet retains 8 private and 19 protected Boolean observations,
24 rejection checks and their behavior mutations on both targets. The protected
browser uses strict CSP; the older private browser harness does not enforce CSP.
The private Number rejection was replaced with the still-held int form after the
new baseline reproduced the Number getter hold and this fixture qualified it.

Run from the compiler root:

```
node tests/native-generated-lexical-getter-returns/run.cjs
node tests/native-generated-lexical-getter-returns/verify.cjs --check-current
node tests/native-generated-lexical-getter-returns/verify-adjacent.cjs --check-current
```

The packets authenticate captured sources, compiler inputs, providers, runners,
generated output, type inputs, both runtime results and mutation results. This
proves the focused getter behavior; full OP2 emission and H5 acceptance remain open.
