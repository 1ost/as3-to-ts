# Private instance int literal constants

The common compiler admits authenticated private instance int literal constants,
performs AS3 ToInt32 conversion and publishes immutable lexical slots. Direct
reads fold the literal and omit the entire receiver expression as AIR does;
computed multiname reads retain lexical lookup and null/constant-write errors.
Private namesakes remain owned by their declaring classes. Typed local shadows
retain their own storage while explicit this references select the constant.

`run.cjs` matches 16 AIR observations for ES5 and ES2015 in Node and strict-CSP
Chromium, with zero generated/dependency type errors, five rejection guards,
two forged-host-argument rejections and three applied mutations per target.
Mutations corrupt the stored value, erase early constant storage and erroneously
evaluate a folded getter receiver; both runtimes detect each mutation.

`node tests/native-generated-private-instance-int-constants/verify.cjs` verifies
retained inputs, sources, bundles, observations, controls and the pre-fix lexical
module rejection against the same source cohort. `--check-current` also checks
present input bytes. The historical lexical module is authenticated by the prior
interface-getter-construction archive; baseline mode does not alter disk files.
The public instance-constant regression retains 10 AIR rows, both targets/runtimes,
six guards and zero type errors. Its obsolete private-int rejection now covers
still-unqualified private uint constants.

Runtime archive: 3,434,417 bytes; SHA-256
`de6b5a52eb4042dc88d00a1cb5d519bbfaa0db3d0a0976af3a68d4bb1637c6f5`.
Other private instance constant types and computed initializers remain held.
This qualification does not establish full TLF factory, font or H5 acceptance.
