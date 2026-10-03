# ColorTransform reference integration

`node tests/native-color-transform-reference/run.cjs` runs the complete original
AIR source fixture retained in the paired common engine's
tests/nativeColorTransformReference. The compiler uses an explicit exact
ColorTransform provider to lower generated `is` and `as` expressions to the
shared nominal reference API. Shadowed targets and initializer operations stay
held. Construction and casts require their own Class authority and are rejected.

Validation covers 19 AIR rows in ES5/ES2015 CSP Chromium with real Laya Sprite
transform returns, six compiler guards, three forgeries, two applied mutations,
zero type errors and 53 adjacent Vector/DataEvent observations. The engine packet
retains exact compiler/engine input hashes; verify it with --check-current.

The separate d4ded10 prerequisite restores original captured Vector evidence
bytes which had been normalized in the prior Git index despite the later-added
-text attributes. Every restored byte was checked against its original receipt
and the committed blobs were rechecked. No AIR capture was regenerated.
