# Native Flash timer authority

This lane admits `flash.utils.getTimer`, `flash.utils.setInterval`,
`flash.utils.clearInterval`, `flash.utils.setTimeout`, and
`flash.utils.clearTimeout`. The checked source census and maintained AS3 roots
currently contain:

| API | calls | files | explicit imports |
| --- | ---: | ---: | ---: |
| `setTimeout` | 56 | 27 | 15 |
| `clearTimeout` | 13 | 6 | 2 |
| `getTimer` | 8 | 5 | 5 |
| `setInterval` | 6 | 4 | 1 |
| `clearInterval` | 7 | 4 | 1 |

The exact authority coordinates are local-tools parent
`bb26daf59401951e58e6f2cc8f93f9437fd63680`, Bleach
`f96e325da3a5806d9c3bbd84df71b6c279fcddd2` and LayaAir
`ecade82aa369d890730c4dc847f9d769d74e8878`. The source census is
`69f054d0bd30b6a0955a4dae4b7ad3ce2d8d2e05958a37fed566778a8ec29858`;
the current capability map has 192 rows and SHA-256
`a9d355200aab8c78453d9d53e8f9b55c3b0c6340753538403e6edeae3c252b42`.
The accepted-runtime-v6 baseline comparison covers 2,907 application and
14 bootstrap sources. The earlier timeout-only admission advanced thirteen
files from semantic
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

The fresh direct-`bb26daf` comparison for `getTimer`, `setInterval`, and
`clearInterval` has five further first-blocker advances, all with unchanged
source SHA-256 and normalized fingerprint:

- `Foundation/LoaderQueue/TLoaderProgress.as` -> `HARDENED_IDENTIFIER_SCOPE`
- `Foundation/Timing/TTimingCore.as` -> `HARDENED_TYPE_UNMAPPED`
- `Processors/Game/Common/Effects/TWheelEffect.as` -> `HARDENED_VECTOR_CONVERSION_SOURCE`
- `Processors/Game/Lobby/Activity/HDHalloween/windows/TprocessorWindowHDHalloweenPumpkinGame.as` -> `HARDENED_ASSIGNMENT_TYPE`
- `ghostcat/util/Tick.as` -> `HARDENED_IDENTIFIER_SCOPE`

Four other maintained consumers are intentionally unchanged because an earlier
unrelated first blocker still wins: `TProcessorPerformance.as` remains at
`HARDENED_FLASH_IMPORT_UNMAPPED`, `TEffectControl.as` remains at
`HARDENED_BINARY_ADD`, and the Barrier/Instance auto-battle consumers remain at
`HARDENED_MEMBER_TARGET`. The accepted Laya `Timer` bridge refresh separately
advances six held files without changing admission: `TLoaderQueue.as` to
`HARDENED_ASSIGNMENT_TYPE`, `TOverlayerInventory.as` and
`TOverlayerNijiaStarAttribute.as` to `HARDENED_SUPER_CONTEXT`,
`TOverlayerPet.as` and `CallLaterQueue.as` to `HARDENED_STATIC_MEMBER`, and
`DelayOper.as` to `HARDENED_TYPE_UNMAPPED`. These are target-ledger advances,
not claims made by the five native package functions.

The subsequent accepted string-constant target refresh separately advances
`TEffectTransition.as` from `HARDENED_FLASH_IMPORT_UNMAPPED` to
`HARDENED_LOCAL_MEMBER_HELD` and `CONST_CURSOR.as` from
`HARDENED_FLASH_IMPORT_UNMAPPED` to `HARDENED_STATIC_MEMBER`. These two are
likewise target-ledger advances, not native-timer-function advances.

Application qualification stays at 338 admitted and 2,569 held; bootstrap
stays at 2 admitted and 12 held with no status changes. The final clean
`f96e325`/`ecade82` application and bootstrap manifests have raw SHA-256
`f1a6678db746a7e09b5a45bad94ab6364253f5f1e59bf035b3b70bed713367eb`
and `24361d3b21e6beb5653f4f1f497f40a15ef48475e6ad14a8dff71298a79fa408`.
The serialized runs used the bounded 60-second parser ceiling; all 2,907/14
source identities and fingerprints match the fresh direct-`bb26daf` baseline.

The authenticated census gives `getTimer` five explicit imports and no
wildcard-resolution role. A `flash.utils.*` import therefore cannot mint a
`getTimer` binding; such a call remains an explicit identifier-scope HOLD.

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
remain bridge-classified and preserve their exact observed roles plus the
playerglobal call signature. A source entry classified only as blocking cannot
authenticate a target.

Timer calls also require exact lexical provenance for the imported binding.
Parameters, locals, catch bindings, own fields/accessors/methods, and every
visible inherited local field/getter/setter/method shadow fail closed before
timer authority is minted. The inherited walk authenticates the complete local
lineage: held or ambiguous declarations remain held, cross-package internal
members fail visibility, and inaccessible private members do not falsely
shadow the imported package function. When a local lineage reaches a mapped
Flash base, admitted source-member mappings can prove that a public or
protected shadow exists, but their absence cannot prove that the Playerglobal
class lacks an unmapped member. This lane does not claim an exhaustive
Playerglobal member inventory. It therefore holds at the first mapped terminal
unless a known public/protected member has already proved a shadow; internal,
private-only, malformed, ambiguous, missing, or cyclic mapped authority also
remains HOLD. This conservative boundary applies equally to direct mapped
bases and local lineages that terminate at one.

The package-internal timer runtime allocates bounded nonzero uint IDs independently of browser
or Node timer handles. Its class and mutable prototype are not exported by the
real package; `@bleach/as3-runtime/AS3Timer` is a frozen, null-prototype facade
with exactly `clearInterval`, `clearTimeout`, `getTimer`, `setInterval`, and
`setTimeout`. The internal runtime reuses released IDs across wrap, removes one-shots
before invoking their callback, forwards extra arguments in order, clears
idempotently, and releases an allocated ID when host scheduling fails. A
one-shot ID is already released before its callback executes, while an interval
remains live if its callback throws. Delay conversion is deterministic and
bounded before the host is called.

The retained Flex 4.16.1 / playerglobal 26 / Pepper Flash 26 oracle under
`tests/flash-oracle/native-timer` establishes the undocumented shared
cancellation domain: `clearInterval(timeoutId)` and
`clearTimeout(intervalId)` both cancel. Production therefore stores the timer
kind with each shared uint ID and dispatches cancellation through that stored
kind's host primitive. A repeating entry remains live while its callback runs,
so self-clear and clear-then-reschedule are safe; a stale queued wrapper cannot
invoke a replacement that reused the same ID. An uncaught callback error
escapes without silently deleting the repeating entry.

`getTimer` captures one package-runtime epoch before `ApplicationEntry` and
uses only the browser's monotonic `performance.now()` clock. It truncates
elapsed milliseconds and returns the exact signed-int32 projection, including
the `0x7fffffff` to `-0x80000000` wrap. A missing, non-finite, or backward clock
fails only when `getTimer` is used; timeout/interval scheduling and module load
remain available. A missing, throwing, or non-finite startup reading is retained
as an unavailable epoch rather than retried later, because a later replacement
would silently change the Flash startup epoch. Later imports share the already
initialized package authority and cannot reset the epoch.

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

Subsequent class-name support is a separate path: direct SDK-authenticated
`getQualifiedClassName` calls pass the sealed `AS3Type` allocation identity query
to Laya's `resolveNativeClassName`. Definition lookup and superclass reflection
remain outside that path; this does not extend the timer authority.
