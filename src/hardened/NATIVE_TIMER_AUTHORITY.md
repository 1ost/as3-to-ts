# Native Flash timer authority

This lane admits only `flash.utils.setTimeout` and
`flash.utils.clearTimeout`. The checked source census and maintained AS3 roots
currently contain:

| API | calls | files | explicit imports |
| --- | ---: | ---: | ---: |
| `setTimeout` | 56 | 27 | 15 |
| `clearTimeout` | 13 | 6 | 2 |

The exact accepted-runtime-v6 baseline comparison uses Bleach
`104f469d8562007bb8e0e8d48a5d0b19d0d1549d` and LayaAir
`7cdca8ac8c91d7cf1b21c0ec0c55b3b078c2f8fc` across 2,907 application and
14 bootstrap sources. Thirteen files advance from semantic
`HARDENED_FLASH_IMPORT_UNMAPPED`: five to `HARDENED_INDEX_TARGET`, four to
`HARDENED_BINARY_OPERATOR`, and one each to `HARDENED_ASSIGNMENT_TYPE`,
`HARDENED_BINARY_RELATION`, `HARDENED_MEMBER_TARGET`, and
`HARDENED_OVERRIDE_AUTHORITY`. Their normalized fingerprints remain unchanged.
The exact paths and next results are:

- `Processors/Game/Battle/Components/TBigSkill.as` -> `HARDENED_INDEX_TARGET`
- `Processors/Game/Battle/TChain.as` -> `HARDENED_BINARY_OPERATOR`
- `Processors/Game/Lobby/Activity/HDActivityChristmas/windows/TProcessorChristmasWishView.as` -> `HARDENED_INDEX_TARGET`
- `Processors/Game/Lobby/Activity/HDCircleTrial/windows/TProcessorWindowHDCircleTrialView.as` -> `HARDENED_INDEX_TARGET`
- `Processors/Game/Lobby/Activity/HDCircleTrial/windows/TProcessorWindowHDTrialExchange.as` -> `HARDENED_ASSIGNMENT_TYPE`
- `Processors/Game/Lobby/Activity/HDDreamComeTrue/windows/TProcessorExchangeView.as` -> `HARDENED_BINARY_RELATION`
- `Processors/Game/Lobby/Activity/HDDreamComeTrue/windows/TProcessorTurntableView.as` -> `HARDENED_INDEX_TARGET`
- `Processors/Game/Lobby/Activity/HDGallery/TProcessorHDViewGallery.as` -> `HARDENED_MEMBER_TARGET`
- `Processors/Game/Lobby/Activity/HDNationalDay2017/Windows/TProcessorNationalThree2017.as` -> `HARDENED_BINARY_OPERATOR`
- `Processors/Game/Lobby/Activity/HDTimeLimitTurntable/TprocessorHDWindowTimeLimitView.as` -> `HARDENED_INDEX_TARGET`
- `Processors/Game/Lobby/Activity/TPlayAnimaEffect.as` -> `HARDENED_BINARY_OPERATOR`
- `Processors/Game/Lobby/HeroCompanion/Components/TCompanionMapItem.as` -> `HARDENED_BINARY_OPERATOR`
- `Processors/Game/Lobby/RelatedPartner/TProcessorWindowRelatedPartner.as` -> `HARDENED_OVERRIDE_AUTHORITY`

`Processors/Game/Lobby/TProcessorLobby.as` is not a timer advance: it must stay
at semantic `HARDENED_MEMBER_TARGET` with its normalized fingerprint present.
A parser timeout or missing fingerprint is a qualification regression. The
earlier count of 11 was incomplete first-blocker evidence, never the maintained
timer scope. The focused end-to-end fixture separately proves the admitted
timer import, call, generated runtime import, method closure, and strict
TypeScript boundary.

`config/native-timer-authority.json` independently pins the native target
module, exact exports, TypeScript signatures, source path, and normalized
source SHA-256. The CLI also reads that ordinary source file and recomputes the
digest before admitting the authority. Source census entries must separately
remain bridge-classified and preserve the `import`, `package-function`, and
`wildcard-resolution` roles plus the exact playerglobal call signature. A
source entry classified only as blocking cannot authenticate a target.

Timer calls also require exact lexical provenance for the imported binding.
Parameters, locals, catch bindings, own fields/accessors/methods, and every
visible inherited local field/getter/setter/method shadow fail closed before
timer authority is minted. The inherited walk authenticates the complete local
lineage: held or ambiguous declarations remain held, cross-package internal
members fail visibility, and inaccessible private members do not falsely
shadow the imported package function.

The package-internal timer runtime allocates bounded nonzero uint IDs independently of browser
or Node timer handles. Its class and mutable prototype are not exported by the
real package; `@bleach/as3-runtime/AS3Timer` is a frozen, null-prototype facade
with exactly `clearTimeout` and `setTimeout`. The internal runtime reuses released IDs across wrap, removes one-shots
before invoking their callback, forwards extra arguments in order, clears
idempotently, and releases IDs when host scheduling or callback execution
throws. Delay conversion is deterministic and bounded before the host is
called.

AS3 instance method values are not passed to the host as unbound JavaScript
methods. Constructor lowering uses the shared `AS3MethodClosure` weak cache.
It preserves the receiver and returns the same callable for repeated
receiver/method admission, including the case where a base constructor
registers a derived override before the derived constructor admits it again.

The accepted Pepper Flash 26 receiver fixture at
`as3-to-layaair-porting-kit/tests/native-runtime/avm2-function-receiver`
demonstrates that an ordinary AS3 function's observable `this` depends on the
invocation opcode, while a method closure keeps its owner. Consequently this
lane does not claim that anonymous callbacks receive JavaScript `undefined`.
Anonymous functions that observe dynamic AS3 `this` remain fail-closed under
`HARDENED_LAMBDA_THIS`; callbacks that do not observe it and authenticated
method closures are admitted.

Reflection functions (`getDefinitionByName`, `getQualifiedClassName`, and
`getQualifiedSuperclassName`) are intentionally outside this candidate. They
remain on hold until the accepted unified native type authority exposes a
sealed identity/definition query; this timer lane neither changes `AS3Type`
nor introduces an AVM, QName, reflection, evaluation, or dynamic-import seam.
